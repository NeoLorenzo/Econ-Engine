import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 19 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 19's code. A change
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
    days: '229b7034:100847',
    totals: 'fc30b49d:498',
  },
  {
    config: 'canonical',
    seed: 1,
    days: 'aed1f7ad:99761',
    totals: 'e266b6c2:498',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'b03dad34:98606',
    totals: 'b11f6155:495',
  },
  {
    config: 'together',
    seed: 20260813,
    days: 'a6bc92f0:100801',
    totals: '8dc84c87:496',
  },
  {
    config: 'together',
    seed: 1,
    days: '50d86b37:99802',
    totals: '8ebf33b5:497',
  },
  {
    config: 'together',
    seed: 2,
    days: 'e795f41d:98534',
    totals: '5f4be39:496',
  },
  {
    config: 'spread',
    seed: 20260813,
    days: '44cd79e7:100301',
    totals: '384c7bd3:495',
  },
  {
    config: 'spread',
    seed: 1,
    days: 'f4118619:99746',
    totals: 'd43e7d4f:495',
  },
  {
    config: 'spread',
    seed: 2,
    days: '3c83a889:98640',
    totals: '83274f4:494',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: 'e4c8cd:101367',
    totals: '46054510:492',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'd93ed8eb:99759',
    totals: '73cd21e3:495',
  },
  {
    config: 'talent',
    seed: 2,
    days: 'd01c4e16:98496',
    totals: 'e722d04a:494',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: 'abb7f046:117898',
    totals: '916f7000:496',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '6102e825:117436',
    totals: '3e735630:497',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '1be31aa0:115592',
    totals: '6b6a8920:498',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '25a9a69b:100928',
    totals: '340748bf:495',
  },
  {
    config: 'alike',
    seed: 1,
    days: '83fddb29:99634',
    totals: '583aea6a:495',
  },
  {
    config: 'alike',
    seed: 2,
    days: '86c1b950:98648',
    totals: 'da6e8aa2:492',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '318bac50:88402',
    totals: 'b47b0ed:460',
  },
  {
    config: 'flat',
    seed: 1,
    days: '3f369937:88397',
    totals: 'e1d6de15:460',
  },
  {
    config: 'flat',
    seed: 2,
    days: 'e8a92fa1:88419',
    totals: '28e35f62:460',
  },
  {
    config: 'forty',
    seed: 20260813,
    days: 'e1d4e35d:241145',
    totals: 'ab64432b:507',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 19 runs exactly as recorded', () => {
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
