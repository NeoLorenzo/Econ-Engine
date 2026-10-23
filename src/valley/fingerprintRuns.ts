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
    days: '9cf73619:68284',
    totals: 'b64a955f:449',
  },
  {
    config: 'canonical',
    seed: 1,
    days: 'fb82c6f4:68117',
    totals: '4a164446:446',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'aa9b7370:68397',
    totals: '323b37fb:446',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '616d6ab0:68260',
    totals: 'aae73d77:444',
  },
  {
    config: 'together',
    seed: 1,
    days: 'a3f2d554:68258',
    totals: 'a3c8a9fe:444',
  },
  {
    config: 'together',
    seed: 2,
    days: 'ed607101:68350',
    totals: 'c452308c:445',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: 'd08181f3:68795',
    totals: 'd5456ca1:449',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: '6951c74b:68727',
    totals: '487363d0:446',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: '369083ba:68842',
    totals: '7931228a:446',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '9a20e498:68217',
    totals: 'f35b5305:449',
  },
  {
    config: 'talent',
    seed: 1,
    days: '6b551f20:68081',
    totals: '996d74c7:447',
  },
  {
    config: 'talent',
    seed: 2,
    days: '382cff0f:68225',
    totals: 'c805692d:446',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: 'dedd032f:81457',
    totals: 'e17d4d9e:454',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '5f17b672:81447',
    totals: '9bcbfa3:452',
  },
  {
    config: 'twelve',
    seed: 2,
    days: 'd4b1ae84:81425',
    totals: 'ec88afd6:452',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '194b6f37:68372',
    totals: 'bbe6e216:449',
  },
  {
    config: 'alike',
    seed: 1,
    days: '818f25f7:68340',
    totals: 'd7e797ed:446',
  },
  {
    config: 'alike',
    seed: 2,
    days: '9a9d5bc0:68429',
    totals: '48b64a56:444',
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
