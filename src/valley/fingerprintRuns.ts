import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 14 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 14's code. A change
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
  noPractice: { ...EIGHT, craftPractice: false },
  talent: { ...EIGHT, craftSkillMinPercent: 50, craftSkillMaxPercent: 150 },
  twelve: { founders: 12 },
  alike: { ...EIGHT, skillMinPercent: 100, skillMaxPercent: 100 },
  flat: FLAT_LAND,
  forty: {},
}

/** Water and observed-ground checks depend on the size of the discovered region; allow slower CI workers. */
const FINGERPRINT_TIMEOUT_MS = 1_800_000

const RECORDED = [
  {
    config: 'canonical',
    seed: 20260813,
    days: 'bb2a4de2:67188',
    totals: 'cb11d50c:465',
  },
  {
    config: 'canonical',
    seed: 1,
    days: 'f6cab3d6:67218',
    totals: 'c0419c57:465',
  },
  {
    config: 'canonical',
    seed: 2,
    days: '58979a9a:67073',
    totals: '8eae5c05:463',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '42089dfe:67028',
    totals: '18ef5238:463',
  },
  {
    config: 'together',
    seed: 1,
    days: '80be29b1:67024',
    totals: '46b2bc0b:464',
  },
  {
    config: 'together',
    seed: 2,
    days: 'f7adf242:67042',
    totals: '8a5858e2:464',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: 'b5c8cfc7:67424',
    totals: '1aeb229c:465',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: 'caee80a8:67456',
    totals: 'd1fa904b:465',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: '7a69b732:67321',
    totals: '56811398:462',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '3974170d:67142',
    totals: 'cdb061f3:465',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'a475d1c2:67179',
    totals: 'e91d6421:465',
  },
  {
    config: 'talent',
    seed: 2,
    days: 'acf9d823:66994',
    totals: '9ec1c8ae:463',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: '81b4f6c8:79655',
    totals: 'ac7948ba:471',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '6d2edbde:79650',
    totals: '80612bef:475',
  },
  {
    config: 'twelve',
    seed: 2,
    days: 'c2bb7b8e:79493',
    totals: '5783eb4:473',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: 'bd3bccb0:67314',
    totals: '89d526f7:465',
  },
  {
    config: 'alike',
    seed: 1,
    days: '655a00dd:67321',
    totals: '5b8422c7:465',
  },
  {
    config: 'alike',
    seed: 2,
    days: '822bef09:67200',
    totals: 'd7c1a2c4:463',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: 'd431caa9:59415',
    totals: 'bdc374cf:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: '33d9b1b0:59466',
    totals: 'd41aa245:437',
  },
  {
    config: 'flat',
    seed: 2,
    days: '9c1e249f:59554',
    totals: '42c6e2eb:437',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: 'c7861e4a:166253',
    totals: '158c67c4:478',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 14 runs exactly as recorded', () => {
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
