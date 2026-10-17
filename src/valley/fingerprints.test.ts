import { describe, expect, it } from 'vitest'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Life 8 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical valley
// and each configuration the experiments use, match fingerprints recorded from Life 8's code. A change that alters
// any trajectory, even a refactor or a speed-up meant to change nothing, fails here.

function fingerprintOf(value: unknown) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

const CONFIGS: Record<string, Partial<ValleyConfig>> = {
  canonical: {},
  together: { scattered: false },
  perMember: { campfirePerMember: true },
  lowOnly: { feedSpare: false },
  larger: { campfireWoodPerHour: 2 },
  ownFires: { sharedFire: false },
  twelve: { bandSize: 12 },
  unequal: { skillMinPercent: 50, skillMaxPercent: 150 },
}

const RECORDED = [
  { config: 'canonical', seed: 20260813, days: 'c4cfb4d1:31853', totals: '2d4fa80b:237' },
  { config: 'canonical', seed: 1, days: '72e22d98:31809', totals: '8e4c67b4:237' },
  { config: 'canonical', seed: 2, days: '337233e2:31892', totals: 'bffd39ba:237' },
  { config: 'together', seed: 20260813, days: 'de767063:31545', totals: '30ac06b6:234' },
  { config: 'together', seed: 1, days: '761a7fd8:31534', totals: '344e040b:234' },
  { config: 'together', seed: 2, days: '55445edb:31546', totals: 'c1ef5cef:234' },
  { config: 'perMember', seed: 20260813, days: '3a3983eb:32097', totals: '31f26d6e:237' },
  { config: 'perMember', seed: 1, days: '14cc4455:32107', totals: 'afa41d83:237' },
  { config: 'perMember', seed: 2, days: 'e03c9c73:32057', totals: 'dba6840f:237' },
  { config: 'lowOnly', seed: 20260813, days: '2b069baf:31920', totals: '8d17743d:244' },
  { config: 'lowOnly', seed: 1, days: 'a1ce75fb:31913', totals: 'd3ea9e2c:242' },
  { config: 'lowOnly', seed: 2, days: '9f36374f:31970', totals: '8173584:242' },
  { config: 'larger', seed: 20260813, days: '2e7aa51:31976', totals: 'b0899472:237' },
  { config: 'larger', seed: 1, days: 'a978e949:31970', totals: 'dcff35d8:237' },
  { config: 'larger', seed: 2, days: 'e03c9c73:32057', totals: 'dba6840f:237' },
  { config: 'ownFires', seed: 20260813, days: '2aa36988:31933', totals: 'db262e27:237' },
  { config: 'ownFires', seed: 1, days: '318440fc:31936', totals: '98b23c4f:237' },
  { config: 'ownFires', seed: 2, days: '2c0a3330:31939', totals: '8fb01529:242' },
  { config: 'twelve', seed: 20260813, days: '70274d7d:36893', totals: '9f24c7be:237' },
  { config: 'twelve', seed: 1, days: '226df5af:36792', totals: 'c4a14f68:237' },
  { config: 'twelve', seed: 2, days: '24ca3c93:36836', totals: '2a390755:237' },
  { config: 'unequal', seed: 20260813, days: 'dc2fe43b:31683', totals: 'cbd7aa3d:237' },
  { config: 'unequal', seed: 1, days: 'f326228c:31752', totals: 'bdacf2eb:237' },
  { config: 'unequal', seed: 2, days: '98ac500b:31630', totals: 'f6b126d0:234' },
] as const

describe('Life 8 runs exactly as recorded', () => {
  for (const recorded of RECORDED) {
    it(`for the ${recorded.config} valley on seed ${recorded.seed}`, () => {
      const start = createValley({ ...CONFIGS[recorded.config], seed: recorded.seed })
      const checker = new ValleyChecker(start)
      const end = runValley(start, 30 * 1_440, { recordEvents: false, onMinute: (state) => checker.assert(state) })
      expect(fingerprintOf(end.days)).toBe(recorded.days)
      expect(fingerprintOf(end.totals)).toBe(recorded.totals)
    })
  }
})
