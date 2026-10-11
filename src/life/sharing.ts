import { carriedKcal } from './food'
import { sameTile } from './world'
import type { Forager, LedgerEntry, LifeConfig } from './types'

export const emptyLedger = (bandSize: number): LedgerEntry[] =>
  Array.from({ length: bandSize }, () => ({ givenKcal: 0, receivedKcal: 0 }))

/**
 * What a forager asks for: enough to satiate it, counting what it already carries. Only a hungry forager asks. It
 * knows its own state; telling the giver is communication, which design rule 1 allows.
 */
export function requestKcal(config: LifeConfig, forager: Forager) {
  if (!forager.alive || !forager.hungry) return 0
  return Math.max(0, config.satiatedAtKcal - forager.energyKcal - carriedKcal(forager.carried))
}

/** A forager owes the giver nothing if the giver has received from it at least as much as it has given it. */
export const owesNothing = (giver: Forager, recipientId: number) => {
  const entry = giver.ledger[recipientId]!
  return entry.receivedKcal >= entry.givenKcal
}

/** The giver's net credit with a forager: what it has received from it beyond what it has given it. */
const netReceived = (giver: Forager, id: number) => giver.ledger[id]!.receivedKcal - giver.ledger[id]!.givenKcal

/**
 * Who a giver would serve, in order, among the foragers on its tile that ask for something. A keeper serves no one.
 * A sharer serves everyone, the lowest reserve first. A reciprocator serves only those that owe it nothing, those that
 * have given it the most net food first, then the lowest reserve. Ties go to the lowest ID.
 */
export function recipientsInOrder(config: LifeConfig, giver: Forager, foragers: readonly Forager[]) {
  if (giver.strategy === 'keeper') return []
  const askers = foragers.filter(
    (other) => other.id !== giver.id && sameTile(other.position, giver.position) && requestKcal(config, other) > 0,
  )
  const byReserve = (a: Forager, b: Forager) => a.energyKcal - b.energyKcal || a.id - b.id
  if (giver.strategy === 'sharer') return askers.sort(byReserve)
  return askers
    .filter((other) => owesNothing(giver, other.id))
    .sort((a, b) => netReceived(giver, b.id) - netReceived(giver, a.id) || byReserve(a, b))
}

/** Both sides' ledgers after a gift. */
export function recordGift(giver: Forager, recipient: Forager, kcal: number) {
  const giverLedger = [...giver.ledger]
  const recipientLedger = [...recipient.ledger]
  const given = giverLedger[recipient.id]!
  const received = recipientLedger[giver.id]!
  giverLedger[recipient.id] = { ...given, givenKcal: given.givenKcal + kcal }
  recipientLedger[giver.id] = { ...received, receivedKcal: received.receivedKcal + kcal }
  return { giverLedger, recipientLedger }
}
