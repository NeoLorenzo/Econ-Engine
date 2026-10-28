import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 15 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 15's code. A change
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
    days: 'bba6f543:66620',
    totals: '31853532:464',
  },
  {
    config: 'canonical',
    seed: 1,
    days: '3a6b437d:66325',
    totals: 'f0375bbb:464',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'aa551dc9:66250',
    totals: '82a6f566:463',
  },
  {
    config: 'together',
    seed: 20260813,
    days: 'fc4d9bf5:66366',
    totals: 'f0d7ab37:463',
  },
  {
    config: 'together',
    seed: 1,
    days: '709ab523:66147',
    totals: '14d50b3e:462',
  },
  {
    config: 'together',
    seed: 2,
    days: '221a3823:66176',
    totals: '172354e2:464',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: 'adcf6810:66613',
    totals: '34c472d6:464',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: '585d816d:66340',
    totals: 'c457c508:464',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: 'c0ef770a:66227',
    totals: '70b8acde:463',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '9111c80d:66677',
    totals: '3fafbe32:464',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'e0d4cca7:66374',
    totals: 'ae28e8ed:464',
  },
  {
    config: 'talent',
    seed: 2,
    days: 'f80778ff:66328',
    totals: '1f4f7c0e:463',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: '45288634:78586',
    totals: '3d678e0:468',
  },
  {
    config: 'twelve',
    seed: 1,
    days: 'f1ceeb30:78472',
    totals: '7880e101:472',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '91e3f305:78366',
    totals: '42626bb:469',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: 'ad43b4bc:66607',
    totals: '8f48c5c:464',
  },
  {
    config: 'alike',
    seed: 1,
    days: '4139543d:66429',
    totals: 'ef7ad196:464',
  },
  {
    config: 'alike',
    seed: 2,
    days: '8f6e59c0:66356',
    totals: '375644b8:463',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '8795e744:59414',
    totals: '7b9b0885:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: '9f68ec56:59465',
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
    days: 'f78f390:162722',
    totals: 'fa9c4b90:477',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 15 runs exactly as recorded', () => {
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
