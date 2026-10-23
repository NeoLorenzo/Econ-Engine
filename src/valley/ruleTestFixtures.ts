import { createSurveyedValley } from './ruleFixtures'
import { FLAT_LAND } from './config'
import { WakeQueue } from './clock'
import type { ValleyConfig, ValleyState, Forager } from './types'
export function bandAt(minute = 600, overrides: Partial<ValleyConfig> = {}) {
  const s = createSurveyedValley({ ...FLAT_LAND, scattered: false, bandSize: 2, ...overrides })
  s.minute = minute
  s.queue = new WakeQueue()
  for (const p of s.foragers) {
    p.wood = 24
    p.shortOfWood = false
    s.totals.initialWood += 24
    s.queue.schedule({ minute, phase: 1, id: p.id, kind: 'end' })
  }
  s.queue.schedule({ minute: (Math.floor(minute / 60) + 1) * 60, phase: 0, id: 0, kind: 'world' })
  return s
}
export function giveHut(s: ValleyState, p: Forager, logs = s.config.hutLogs) {
  p.hutId = s.huts.length
  s.huts.push({
    id: p.hutId,
    builderId: p.id,
    x: p.hearth.x,
    y: p.hearth.y,
    logs,
    begunMinute: 0,
    abandonedMinute: null,
  })
  s.logStock[64]! -= logs
  s.totals.logsCut += logs
}
export const testAxe = (quality = 100, logsLeft = 200) => ({ id: 0, makerId: 0, madeMinute: 0, quality, logsLeft })
