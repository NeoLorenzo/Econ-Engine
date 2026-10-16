import { describe, expect, it } from 'vitest'
import { LIFE3_BAND } from './config'
import { createValley, runValley } from './engine'
import { life5 } from './experiments'
import type { DaySummary } from './types'

// Life 6's experiment 4: with groups, scattering and exploring off and the valley known, and Life 7's sight and loads
// off, and Life 8's shared fire, the valley runs exactly as Life 5. The fingerprints were recorded from Life 5's code before Life 6 changed it,
// over 30 days on three seeds, for the band born equal and for Life 3's band, whose swaps start within days.

/** The fields Life 6, Life 7 and Life 8 added to a day's summary. */
const LATER_DAY_FIELDS = new Set([
  'groupsStanding',
  'loners',
  'foundings',
  'joinings',
  'dissolutions',
  'placesSeenById',
  'loadedWalkSecondsById',
  'sitesKnownById',
  'sitesCheckedById',
  'fireGivenById',
  'campfireBurnedWood',
  'fireLitHours',
  'fireDarkHours',
])

function fingerprintOf(value: unknown) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

const life5Days = (days: DaySummary[]) =>
  days.map((day) => Object.fromEntries(Object.entries(day).filter(([key]) => !LATER_DAY_FIELDS.has(key))))

const RECORDED = [
  { band: 'equal', seed: 20260813, days: '10c34f03:20961', totals: '321b4f84:237' },
  { band: 'equal', seed: 1, days: '37b62d8a:20962', totals: '7706422e:237' },
  { band: 'equal', seed: 2, days: '52568d73:20965', totals: '289ee4f3:237' },
  { band: 'born', seed: 20260813, days: '90c7b5ab:20962', totals: '15730a0d:243' },
  { band: 'born', seed: 1, days: 'f806a040:21013', totals: '444ce541:243' },
  { band: 'born', seed: 2, days: '1809adf4:21016', totals: '4441a9:243' },
] as const

describe('Life 6 experiment 4: Life 5 is a special case', () => {
  for (const recorded of RECORDED) {
    it(`runs exactly as Life 5 did, for the band ${recorded.band === 'equal' ? 'born equal' : 'born unequal'} on seed ${recorded.seed}`, () => {
      const overrides = life5({ ...(recorded.band === 'born' ? LIFE3_BAND : {}), seed: recorded.seed })
      const end = runValley(createValley(overrides), 30 * 1_440, { recordEvents: false })
      expect(fingerprintOf(life5Days(end.days))).toBe(recorded.days)
      expect(fingerprintOf(end.totals)).toBe(recorded.totals)
    })
  }
})
