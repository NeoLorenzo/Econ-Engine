import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 17 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 17's code. A change
// that alters any trajectory, even a refactor or a speed-up meant to change nothing, fails here. Those configurations
// were recorded with the first pull request's eight founders and keep them; the forty-founder default has one run.

function fingerprintOf(value: unknown) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

const EIGHT = { founders: 8 }

const CONFIGS: Record<string, Partial<ValleyConfig>> = {
  canonical: EIGHT,
  together: { ...EIGHT, scattered: false },
  spread: { ...EIGHT, inventPerMillionPerHour: 50_000 },
  talent: { ...EIGHT, talentRule: { base: 1_000, effect: 500, low: 250, high: 1_750 } },
  twelve: { founders: 12 },
  alike: { ...EIGHT, talentRule: { base: 1_000, effect: 0, low: 1_000, high: 1_000 } },
  flat: FLAT_LAND,
  forty: {},
}

/** Water and observed-ground checks depend on the size of the discovered region; allow slower CI workers. */
const FINGERPRINT_TIMEOUT_MS = 1_800_000

const RECORDED = [
  {
    config: 'canonical',
    seed: 20260813,
    days: '3d2ba49e:84690',
    totals: '2b717cf0:468',
  },
  {
    config: 'canonical',
    seed: 1,
    days: '24eeec35:84125',
    totals: '2b73c06a:470',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'af9a6485:84089',
    totals: '4592e20b:470',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '580f75c8:84395',
    totals: '528f163e:466',
  },
  {
    config: 'together',
    seed: 1,
    days: 'b19c6bcf:84054',
    totals: 'f93afb9:469',
  },
  {
    config: 'together',
    seed: 2,
    days: 'de3cf238:84151',
    totals: 'bdabff94:469',
  },
  {
    config: 'spread',
    seed: 20260813,
    days: '8e98754a:84582',
    totals: 'ec74af02:469',
  },
  {
    config: 'spread',
    seed: 1,
    days: '64e66fac:84101',
    totals: 'f881d70b:470',
  },
  {
    config: 'spread',
    seed: 2,
    days: 'c6feab3e:84063',
    totals: '7d16ab85:470',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: 'b616494e:84664',
    totals: '64bee26a:470',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'aad61387:83981',
    totals: '341f0415:469',
  },
  {
    config: 'talent',
    seed: 2,
    days: 'fd0310c6:84125',
    totals: '938f44b1:468',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: '87e2a49d:100463',
    totals: '8de0b6f6:470',
  },
  {
    config: 'twelve',
    seed: 1,
    days: 'f3e9f162:99996',
    totals: 'c7ab84e7:470',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '42e64dab:100079',
    totals: '4d9dce77:475',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '2c256775:84799',
    totals: 'c0364eb0:469',
  },
  {
    config: 'alike',
    seed: 1,
    days: '7fe02068:84168',
    totals: 'bc6f9b2c:470',
  },
  {
    config: 'alike',
    seed: 2,
    days: 'a1e7dcf5:84380',
    totals: '354f9d8f:466',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '46ed31ba:76812',
    totals: '949bfd1:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: '75f35ea2:76924',
    totals: 'fcfca152:437',
  },
  {
    config: 'flat',
    seed: 2,
    days: 'f6f1ad7a:76714',
    totals: '1bc5e69e:437',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: '52e10826:213029',
    totals: 'e2f64336:481',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 17 runs exactly as recorded', () => {
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
