import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 18 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 18's code. A change
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
    days: 'fae38c29:96076',
    totals: 'b4011be7:498',
  },
  {
    config: 'canonical',
    seed: 1,
    days: 'bc941c66:95016',
    totals: '20cbf478:498',
  },
  {
    config: 'canonical',
    seed: 2,
    days: '2f5f7206:93866',
    totals: 'b29b4e4e:495',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '827b2357:96024',
    totals: '9762052e:496',
  },
  {
    config: 'together',
    seed: 1,
    days: '53a80efe:95003',
    totals: 'a54da8b5:497',
  },
  {
    config: 'together',
    seed: 2,
    days: 'b3cd105b:93795',
    totals: '19e0b699:496',
  },
  {
    config: 'spread',
    seed: 20260813,
    days: '9e8cec51:95562',
    totals: '28e983ae:495',
  },
  {
    config: 'spread',
    seed: 1,
    days: 'ecc0f5c9:95000',
    totals: '6014635e:495',
  },
  {
    config: 'spread',
    seed: 2,
    days: 'f439003b:93905',
    totals: '40b08e02:494',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '3cbe9eaa:96619',
    totals: '7dae6763:492',
  },
  {
    config: 'talent',
    seed: 1,
    days: '588437ae:95011',
    totals: 'b399304:495',
  },
  {
    config: 'talent',
    seed: 2,
    days: '13654e9c:93757',
    totals: '2529b5e:494',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: '34bdd9e4:113129',
    totals: '8406c0b1:496',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '2f31d4b8:112621',
    totals: '8372d6b8:497',
  },
  {
    config: 'twelve',
    seed: 2,
    days: 'd87db2b7:110829',
    totals: '10486616:498',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: 'ca635726:96174',
    totals: '68bfd066:495',
  },
  {
    config: 'alike',
    seed: 1,
    days: '31a39d10:94891',
    totals: 'f62090e5:495',
  },
  {
    config: 'alike',
    seed: 2,
    days: '28bc23bb:93909',
    totals: '4472e437:492',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: 'd80227bd:83662',
    totals: 'b47b0ed:460',
  },
  {
    config: 'flat',
    seed: 1,
    days: '61250656:83657',
    totals: 'e1d6de15:460',
  },
  {
    config: 'flat',
    seed: 2,
    days: 'e6a874fd:83679',
    totals: '28e35f62:460',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: '5644f0da:236340',
    totals: '2b6da16:507',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 18 runs exactly as recorded', () => {
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
