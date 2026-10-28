import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from '../valley/config'
import { advanceValley, cloneValley, stepValley } from '../valley/engine'
import { createSurveyedValley } from '../valley/ruleFixtures'
import { applyChange, changeOf, stateOf, wireOf, type Wire } from './viewCopy'

/** What crosses between threads: a copy that shares nothing with the engine's objects. The layout is built on both sides. */
const across = (wire: Wire): Wire => ({ ...structuredClone({ ...wire, layout: null }), layout: wire.layout })

describe('view copies', () => {
  it('rebuilds each state’s view copy on the page from the changes alone', () => {
    // As in the worker, the state runs on in place, so a copy that shared its objects would lose changes.
    const state = createSurveyedValley(FLAT_LAND),
      pure = { state: cloneValley(state) }
    let sent = wireOf(state, 0)
    let page = across(sent)
    let followed = 0
    // Strides as at each speed, and a change of the person followed part-way.
    for (const stride of [1, 1, 7, 60, 1, 300, 24, 900, 1, 1_440, 61]) {
      advanceValley(state, state.minute + stride)
      pure.state = stepValley(pure.state, pure.state.minute + stride)
      if (stride === 300) followed = 3
      const wire = wireOf(state, followed, sent)
      page = applyChange(page, structuredClone(changeOf(wire, sent)))
      sent = wire
      expect({ ...page, layout: null }).toEqual({ ...wire, layout: null })
      expect({ ...wire, layout: null }).toEqual({ ...wireOf(pure.state, followed, sent), layout: null })
    }
    expect(state.minute).toBeGreaterThan(2_700)
    expect(page.layout).toBe(sent.layout)
  })

  it('keeps only what the page reads', () => {
    const earlier = stepValley(createSurveyedValley(FLAT_LAND), 1_440)
    const last = wireOf(earlier, 2)
    const state = stepValley(earlier, 2 * 1_440)
    const wire = wireOf(state, 2, last)
    const inUse = state.foragers.map((p) => p.task?.routeId ?? -1).filter((id) => id >= 0)
    expect(Object.keys(wire.routes).map(Number).sort()).toEqual([...new Set(inUse)].sort())
    expect(state.routes.length).toBeGreaterThan(inUse.length)
    for (const p of state.foragers) {
      expect(wire.queue[p.id]).toEqual(state.queue.entriesOf(p.id)[0] ?? null)
      expect(stateOf(wire).queue.entriesOf(p.id)[0] ?? null).toEqual(wire.queue[p.id])
      // Memory is a current copy for the person followed, and the last copy's for everyone else.
      for (const key of ['knowledge', 'knownPlaces', 'placeStock', 'knownBanks'] as const)
        if (p.id === 2) {
          expect(wire.foragers[p.id]![key]).toEqual(p[key])
          expect(wire.foragers[p.id]![key]).not.toBe(p[key])
        } else expect(wire.foragers[p.id]![key]).toBe(last.foragers[p.id]![key])
    }
    const moved = (p: (typeof state.foragers)[number]) =>
      (['knowledge', 'ways', 'knownPlaces', 'placeStock'] as const).some(
        (key) => p[key] !== earlier.foragers[p.id]![key],
      )
    expect(state.foragers.some((p) => p.id !== 2 && moved(p))).toBe(true)
    expect(wire.eventDays.flat().every((e) => e.kind === 'exchange' || e.kind === 'walk')).toBe(true)
    expect(wire.eventDays.flat().some((e) => e.kind === 'walk')).toBe(true)
    expect(wire.lastInterval.every((e) => e.kind === 'exchange')).toBe(true)
  })

  it('sends nothing for a state the engine recopied unchanged', () => {
    const state = stepValley(createSurveyedValley(FLAT_LAND), 600)
    expect(changeOf(wireOf(cloneValley(state), 0), wireOf(state, 0))).toBeNull()
  })
})
