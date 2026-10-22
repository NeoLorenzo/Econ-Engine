import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 11 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 11's code. A change
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

/** Water and observed-ground checks depend on the size of the discovered region; allow slower CI workers. */
const FINGERPRINT_TIMEOUT_MS = 1_800_000

const RECORDED = [
  {
    config: 'canonical',
    seed: 20260813,
    days: '95db3fa3:68302',
    totals: 'dbcdb1:449',
  },
  {
    config: 'canonical',
    seed: 1,
    days: 'bcc126ab:68187',
    totals: '836caeef:446',
  },
  {
    config: 'canonical',
    seed: 2,
    days: '24f48efb:68513',
    totals: '2441e737:446',
  },
  {
    config: 'together',
    seed: 20260813,
    days: 'cd1f3d94:68262',
    totals: '7ebf7851:446',
  },
  {
    config: 'together',
    seed: 1,
    days: 'aa400be9:68289',
    totals: '49633103:444',
  },
  {
    config: 'together',
    seed: 2,
    days: '13f996a0:68338',
    totals: 'ae7cdde5:444',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: '54236d8c:68777',
    totals: '5ecfafc:449',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: 'fe9ebae7:68749',
    totals: '279ea083:446',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: 'f4bbaa3f:68931',
    totals: '2b32b46d:446',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '8e37e8e2:68177',
    totals: '42c1d96b:449',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'ae07d13d:68114',
    totals: 'b10a15bc:446',
  },
  {
    config: 'talent',
    seed: 2,
    days: 'dedc6ec9:68368',
    totals: 'd5651822:446',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: 'e25f1ec2:81480',
    totals: '3b9d9163:454',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '2577a073:81614',
    totals: '24e27f55:452',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '8b8604bd:81732',
    totals: '6a542385:452',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '860059a7:68343',
    totals: 'dbe5bacf:449',
  },
  {
    config: 'alike',
    seed: 1,
    days: 'ec2d6a58:68514',
    totals: 'c619d356:446',
  },
  {
    config: 'alike',
    seed: 2,
    days: '7a951360:68774',
    totals: '4e704cf8:446',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '5533eada:58761',
    totals: '5fa18a72:422',
  },
  {
    config: 'flat',
    seed: 1,
    days: 'c6fdf013:58810',
    totals: '61345239:422',
  },
  {
    config: 'flat',
    seed: 2,
    days: '3128aafd:58898',
    totals: '411fb3f:422',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 11 runs exactly as recorded', () => {
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
