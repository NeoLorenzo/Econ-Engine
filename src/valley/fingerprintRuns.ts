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
  { config: 'canonical', seed: 20260813, days: '35d07f45:53675', totals: '1120b933:446' },
  { config: 'canonical', seed: 1, days: 'd0daf3d5:53473', totals: '4522dd7d:446' },
  { config: 'canonical', seed: 2, days: 'eb8bdca7:53587', totals: '18305a0:446' },
  { config: 'together', seed: 20260813, days: '2b8b904e:53337', totals: '33cc6683:444' },
  { config: 'together', seed: 1, days: '7889f54b:53266', totals: '487f6602:444' },
  { config: 'together', seed: 2, days: '1f00d39d:53329', totals: '89172e85:444' },
  { config: 'noPractice', seed: 20260813, days: '2b47ebb3:54216', totals: '8df02636:446' },
  { config: 'noPractice', seed: 1, days: '969276a0:54052', totals: '93b813a5:446' },
  { config: 'noPractice', seed: 2, days: 'be38e854:54128', totals: '6ba21328:446' },
  { config: 'talent', seed: 20260813, days: '6177b280:53536', totals: '2396c23:446' },
  { config: 'talent', seed: 1, days: 'a713baf2:53388', totals: 'cc350afd:446' },
  { config: 'talent', seed: 2, days: 'f476e427:53453', totals: 'e2fff32e:446' },
  { config: 'twelve', seed: 20260813, days: '9c41ef60:62537', totals: '16e9f0d0:452' },
  { config: 'twelve', seed: 1, days: '9cdc6826:62554', totals: '5c2a5a29:452' },
  { config: 'twelve', seed: 2, days: '1508e6aa:62503', totals: '1432374a:452' },
  { config: 'alike', seed: 20260813, days: 'd7652acf:53877', totals: '9677e145:446' },
  { config: 'alike', seed: 1, days: '1668a4f2:53691', totals: 'a34f74b0:446' },
  { config: 'alike', seed: 2, days: '21a76b25:53699', totals: '5cb34b56:446' },
  { config: 'flat', seed: 20260813, days: 'f615ab5f:51330', totals: '8f72e029:440' },
  { config: 'flat', seed: 1, days: 'ac79af27:51267', totals: 'e182c168:438' },
  { config: 'flat', seed: 2, days: '4c29d0a:51461', totals: 'ef1955d5:440' },
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
          expect(fingerprintOf(end.days)).toBe(recorded.days)
          expect(fingerprintOf(end.totals)).toBe(recorded.totals)
        },
        FINGERPRINT_TIMEOUT_MS,
      )
    }
  })
}
