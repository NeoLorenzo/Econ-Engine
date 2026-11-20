import type { Forager, ValleyState } from './types'

type Family = Pick<Forager, 'id' | 'motherId' | 'fatherId'>
type People = readonly Family[]

const parentsOf = (p: Family) => [p.motherId, p.fatherId].filter((id): id is number => id !== null)
const isParent = (parent: Family, child: Family) => child.motherId === parent.id || child.fatherId === parent.id

/** Siblings' relatedness: 500 sharing both recorded parents, 250 sharing one, else 0. */
function siblings(a: Family, b: Family) {
  if (a.id === b.id) return 0
  const mother = a.motherId !== null && a.motherId === b.motherId,
    father = a.fatherId !== null && a.fatherId === b.fatherId
  return mother && father ? 500 : mother || father ? 250 : 0
}

/**
 * Relatedness in per mille from the parents recorded at birth (Life 19): 500 for parent and child and for full
 * siblings; 250 for half siblings, grandparent and grandchild, and aunt or uncle and niece or nephew by a full sibling;
 * 125 for first cousins and an aunt or uncle by a half sibling; else 0. Founders have no kin.
 */
export function relatedness(people: People, a: Family, b: Family): number {
  if (a.id === b.id) return 0
  if (isParent(a, b) || isParent(b, a)) return 500
  const sib = siblings(a, b)
  if (sib) return sib
  let best = 0
  for (const [x, y] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const parentId of parentsOf(y)) {
      const parent = people[parentId]!
      // A grandparent of y.
      if (isParent(x, parent)) best = Math.max(best, 250)
      // An aunt or uncle of y.
      const s = siblings(x, parent)
      if (s === 500) best = Math.max(best, 250)
      else if (s === 250) best = Math.max(best, 125)
    }
  }
  // First cousins: a parent of each are full siblings.
  for (const pa of parentsOf(a))
    for (const pb of parentsOf(b)) if (siblings(people[pa]!, people[pb]!) === 500) best = Math.max(best, 125)
  return best
}

/** Kin: relatedness of 125 per mille or more. Kin never pair. */
export const areKin = (people: People, a: Family, b: Family) => relatedness(people, a, b) >= 125

/** The relatedness that weighs in giving and asking: a partner counts as 500. */
export const closeness = (people: readonly Forager[], a: Forager, b: Forager) =>
  a.partnerId === b.id ? 500 : relatedness(people, a, b)

/** Whether a person can walk on their own: their walking factor is at least `carryBelowPerMille`. */
export const canWalk = (state: Pick<ValleyState, 'config'>, person: Forager) =>
  person.walkPerMille >= state.config.carryBelowPerMille

const sameHearth = (a: Forager, b: Forager) => a.hearth.x === b.hearth.x && a.hearth.y === b.hearth.y

/** A person's living children who share their hearth. */
export const childrenAtHome = (state: Pick<ValleyState, 'foragers'>, person: Forager) =>
  state.foragers.filter((child) => child.alive && isParent(person, child) && sameHearth(person, child))

/** Whether a person shares the hearth of a living parent; such a person founds and joins groups only with them. */
export const livesWithParent = (state: Pick<ValleyState, 'foragers'>, person: Forager) =>
  parentsOf(person).some((id) => {
    const parent = state.foragers[id]!
    return parent.alive && sameHearth(parent, person)
  })

/** The living parents who share a person's hearth. */
export const parentsAtHearth = (state: Pick<ValleyState, 'foragers'>, person: Forager) =>
  parentsOf(person)
    .map((id) => state.foragers[id]!)
    .filter((parent) => parent.alive && sameHearth(parent, person))

/**
 * Whether a fire warms a sleeper: their group's, or with no group their own or, from Life 19, that of a parent at
 * their hearth.
 */
export const fireWarms = (state: Pick<ValleyState, 'foragers' | 'groups'>, person: Forager) =>
  person.groupId !== null
    ? state.groups[person.groupId]!.fireLit
    : person.warm || parentsAtHearth(state, person).some((parent) => parent.groupId === null && parent.warm)

/**
 * The person who carries a child who cannot walk: their mother if living, else their father if living, else the living
 * kin of highest relatedness, ties by greater age then lower id, who can walk and whose load capacity holds them.
 */
export function carrierOf(state: Pick<ValleyState, 'foragers' | 'config'>, child: Forager): Forager | null {
  const mother = child.motherId === null ? null : state.foragers[child.motherId]!
  if (mother?.alive) return mother
  const father = child.fatherId === null ? null : state.foragers[child.fatherId]!
  if (father?.alive) return father
  let best: Forager | null = null,
    bestR = 0
  for (const other of state.foragers) {
    if (!other.alive || other.id === child.id || !canWalk(state, other) || other.loadCapacityKg < child.weightKg)
      continue
    const r = relatedness(state.foragers, child, other)
    if (r < 125) continue
    if (
      r > bestR ||
      (r === bestR &&
        best !== null &&
        (other.birthMinute < best.birthMinute || (other.birthMinute === best.birthMinute && other.id < best.id)))
    ) {
      best = other
      bestR = r
    }
  }
  return best
}

/** Kin who share a person's hearth, living. */
export const kinAtHearth = (state: Pick<ValleyState, 'foragers'>, person: Forager) =>
  state.foragers.filter(
    (other) =>
      other.alive && other.id !== person.id && sameHearth(person, other) && areKin(state.foragers, person, other),
  )
