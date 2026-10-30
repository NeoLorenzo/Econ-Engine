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
    days: '53746157:81780',
    totals: '2b717cf0:468',
  },
  {
    config: 'canonical',
    seed: 1,
    days: '244368:81125',
    totals: '2b73c06a:470',
  },
  {
    config: 'canonical',
    seed: 2,
    days: '16c6c0f0:81299',
    totals: '4592e20b:470',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '5133022b:81485',
    totals: '528f163e:466',
  },
  {
    config: 'together',
    seed: 1,
    days: '90b051c:81058',
    totals: 'f93afb9:469',
  },
  {
    config: 'together',
    seed: 2,
    days: '4301c73f:81361',
    totals: 'bdabff94:469',
  },
  {
    config: 'spread',
    seed: 20260813,
    days: 'cf17d853:81672',
    totals: 'ec74af02:469',
  },
  {
    config: 'spread',
    seed: 1,
    days: 'f6711a1:81101',
    totals: 'f881d70b:470',
  },
  {
    config: 'spread',
    seed: 2,
    days: 'e1eeff2b:81273',
    totals: '7d16ab85:470',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '44a5db8a:81754',
    totals: '64bee26a:470',
  },
  {
    config: 'talent',
    seed: 1,
    days: '30488f35:81041',
    totals: '341f0415:469',
  },
  {
    config: 'talent',
    seed: 2,
    days: '43944c72:81335',
    totals: '938f44b1:468',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: 'd5672d00:96683',
    totals: '8de0b6f6:470',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '2af0f32c:96196',
    totals: 'c7ab84e7:470',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '199a6789:96453',
    totals: '4d9dce77:475',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '117c6f68:81739',
    totals: 'c0364eb0:469',
  },
  {
    config: 'alike',
    seed: 1,
    days: 'fb81143e:81108',
    totals: 'bc6f9b2c:470',
  },
  {
    config: 'alike',
    seed: 2,
    days: '86ab4206:81320',
    totals: '354f9d8f:466',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '44a8e0a8:73902',
    totals: '949bfd1:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: '2806941:73924',
    totals: 'fcfca152:437',
  },
  {
    config: 'flat',
    seed: 2,
    days: '26f765bc:73924',
    totals: '1bc5e69e:437',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: '4c44789e:203345',
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
