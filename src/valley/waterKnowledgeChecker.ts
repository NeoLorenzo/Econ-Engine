import { bankApproach, bankCircleWet, bankWaterHeight } from './banks'
import { knownDrySegment, routeCentre, type GroundKnowledge } from './legacyRoutes'
import { heightAt } from './terrain'
import { cardinalCells } from './water'
import { placeCentreOf, placeOf, viewFrom } from './sight'
import type { ActionEvent, BankMemory, ValleyState } from './types'

/** Replays observation records into a separate map; movement is checked against this map, never unverified memory. */
export class WaterKnowledgeChecker {
  private ground: GroundKnowledge[]
  private banks: Map<number, BankMemory>[]

  constructor(state: ValleyState) {
    this.ground = state.foragers.map((person) => ({
      ...person.groundKnowledge,
      observed: person.groundKnowledge.observed.slice(),
      heights: person.groundKnowledge.heights.slice(),
    }))
    this.banks = state.foragers.map((person) => new Map(person.knownBanks))
  }

  check(state: ValleyState, event: ActionEvent, fail: (message: string) => void) {
    const { config, layout } = state
    const person = state.foragers[event.foragerId]!
    const known = this.ground[event.foragerId]!
    const banks = this.banks[event.foragerId]!
    const water = layout.terrain.water
    for (const observation of event.observations) {
      const origin = observation.far ? placeCentreOf(config, placeOf(config, event.from.x, event.from.y)) : event.from
      const visible = observation.far
        ? new Set(viewFrom(config, layout, placeOf(config, event.from.x, event.from.y)).visible)
        : null
      const radius = observation.far ? config.sightRadiusCm : config.perceptionRadiusCm
      if (
        observation.minute !== event.minute ||
        observation.foragerId !== person.id ||
        observation.origin.x !== origin.x ||
        observation.origin.y !== origin.y ||
        observation.radiusCm !== radius ||
        !observation.cells.length
      )
        fail('Invalid water observation origin or time')
      if (
        observation.far &&
        (person.farMinute !== event.minute || person.farPlace !== placeOf(config, event.from.x, event.from.y))
      )
        fail('A far water observation was not made by long sight')
      for (const cell of observation.cells) {
        if (!Number.isInteger(cell) || cell < 0 || cell >= known.observed.length || known.observed[cell] !== 0) {
          fail('Invalid or repeated observed cell')
          continue
        }
        const x = (cell % known.cells) * known.cellCm
        const y = Math.floor(cell / known.cells) * known.cellCm
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          const px = x + dx! * known.cellCm
          const py = y + dy! * known.cellCm
          if (
            (px - origin.x) ** 2 + (py - origin.y) ** 2 > radius ** 2 ||
            (visible && !visible.has(placeOf(config, px, py)))
          )
            fail('A cell was observed outside sight')
        }
        const centre = routeCentre(known, cell)
        known.observed[cell] = water.shore
          ? bankWaterHeight(water.shore, centre, water.level) === null
            ? 1
            : 2
          : water.body[cell]! < 0
            ? 1
            : 2
        known.heights[cell] = heightAt(layout.terrain, centre.x, centre.y)
      }
      for (const bank of observation.banks) {
        if (water.shore) {
          const segment = water.shore.segments.get(bank.id)
          const expected = segment
            ? bankApproach(
                water.shore,
                segment,
                config.reachCm,
                config.drinkBankHeightCm,
                (x, y) => heightAt(layout.terrain, x, y),
                water.bodies[segment.body]!.id,
                event.minute,
              )
            : null
          if (
            !segment ||
            !expected ||
            banks.has(bank.id) ||
            !known.observed[segment.cell] ||
            !known.observed[bank.dryCell] ||
            bank.id !== bank.segmentId ||
            bank.wetCell !== expected.wetCell ||
            bank.dryCell !== expected.dryCell ||
            bank.x !== expected.x ||
            bank.y !== expected.y ||
            bank.bodyId !== expected.bodyId ||
            bank.minute !== event.minute ||
            bankCircleWet(water.shore, bank, 1)
          )
            fail('A bank does not match its visible contour and dry approach')
          banks.set(bank.id, { ...bank })
          continue
        }
        if (
          banks.has(bank.id) ||
          known.observed[bank.wetCell] !== 2 ||
          known.observed[bank.dryCell] !== 1 ||
          !cardinalCells(known.cells, bank.wetCell).includes(bank.dryCell)
        ) {
          fail('Invalid observed bank')
          continue
        }
        const wet = routeCentre(known, bank.wetCell)
        const dry = routeCentre(known, bank.dryCell)
        const inset = Math.min(50, config.reachCm)
        const edge =
          bank.dryCell === bank.wetCell - known.cells
            ? 0
            : bank.dryCell === bank.wetCell - 1
              ? 1
              : bank.dryCell === bank.wetCell + 1
                ? 2
                : 3
        if (
          bank.id !== bank.wetCell * 4 + edge ||
          bank.minute !== event.minute ||
          bank.x !== Math.floor((wet.x + dry.x) / 2) + inset * Math.sign(dry.x - wet.x) ||
          bank.y !== Math.floor((wet.y + dry.y) / 2) + inset * Math.sign(dry.y - wet.y) ||
          bank.bodyId !== water.bodies[water.body[bank.wetCell]!]!.id ||
          heightAt(layout.terrain, bank.x, bank.y) - water.level[bank.wetCell]! > config.drinkBankHeightCm
        )
          fail('A bank does not match its visible wet edge and dry approach')
        banks.set(bank.id, { ...bank })
      }
      known.revision += 1
    }
    if (person.groundKnowledge.revision !== known.revision || person.knownBanks.size !== banks.size)
      fail('Water knowledge changed without observation')
    for (const segment of event.segments)
      if (!knownDrySegment(known, segment.from, segment.to)) fail('Movement used unknown ground or crossed water')
    for (const id of [event.drinkBankId, event.fishBankId]) {
      if (id === null) continue
      const expected = banks.get(id)
      const actual = person.knownBanks.get(id)
      if (
        !expected ||
        !actual ||
        expected.bodyId !== actual.bodyId ||
        expected.x !== actual.x ||
        expected.y !== actual.y
      )
        fail('An action used an unobserved or altered bank')
    }
    if (event.minute % 60 === 0) {
      for (let cell = 0; cell < known.observed.length; cell += 1)
        if (
          known.observed[cell] !== person.groundKnowledge.observed[cell] ||
          (known.observed[cell] && known.heights[cell] !== person.groundKnowledge.heights[cell])
        ) {
          fail('Ground memory does not match its observation records')
          break
        }
      for (const [id, expected] of banks) {
        const actual = person.knownBanks.get(id)
        if (!actual || actual.bodyId !== expected.bodyId || actual.x !== expected.x || actual.y !== expected.y)
          fail('Bank memory does not match observations')
      }
    }
  }
}
