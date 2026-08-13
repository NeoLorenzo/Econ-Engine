import type { SimulationEvent } from '../sim/types'

export interface DisplayEvent {
  key: string
  day: number
  type: string
  description: string
  details: SimulationEvent[]
  grouped: boolean
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export function groupEventsForDisplay(events: SimulationEvent[]): DisplayEvent[] {
  const displayed: DisplayEvent[] = []
  const householdGroups = new Map<number, DisplayEvent>()
  const transferGroups = new Map<number, DisplayEvent>()

  for (const event of events) {
    if (event.type === 'HOUSEHOLD_PURCHASE'
      || event.type === 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS'
      || event.type === 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT') {
      let group = householdGroups.get(event.day)
      if (!group) {
        group = { key: `market-${event.day}`, day: event.day, type: 'HOUSEHOLD PURCHASES', description: '', details: [], grouped: true }
        householdGroups.set(event.day, group)
        displayed.push(group)
      }
      group.details.push(event)
      continue
    }

    if (event.type === 'TRANSFER_RECEIVED') {
      let group = transferGroups.get(event.day)
      if (!group) {
        group = { key: `redistribution-${event.day}`, day: event.day, type: 'REDISTRIBUTION', description: '', details: [], grouped: true }
        transferGroups.set(event.day, group)
        displayed.push(group)
      }
      group.details.push(event)
      continue
    }

    displayed.push({
      key: `event-${event.id}`,
      day: event.day,
      type: event.type.replaceAll('_', ' '),
      description: event.description,
      details: [event],
      grouped: false,
    })
  }

  for (const group of householdGroups.values()) {
    const purchases = group.details.filter((event) => event.type === 'HOUSEHOLD_PURCHASE')
    const affordabilityFailures = group.details.filter((event) => event.type === 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS').length
    const stockoutFailures = group.details.filter((event) => event.type === 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT').length
    const total = purchases.reduce((sum, event) => sum + (event.amountCents ?? 0), 0)
    const price = purchases[0]?.amountCents ?? group.details.find((event) => event.priceCents !== undefined)?.priceCents ?? 0
    if (purchases.length === 0) {
      group.type = 'PURCHASES FAILED'
      group.description = affordabilityFailures === group.details.length
        ? `0 purchased · ${affordabilityFailures} affordability failures at ${money(price)}.`
        : `0 purchased · ${affordabilityFailures} affordability failures · ${stockoutFailures} stockout failures.`
    } else {
      const failureParts = [
        affordabilityFailures ? `${affordabilityFailures} affordability failure${affordabilityFailures === 1 ? '' : 's'}` : '',
        stockoutFailures ? `${stockoutFailures} stockout failure${stockoutFailures === 1 ? '' : 's'}` : '',
      ].filter(Boolean)
      group.description = `${purchases.length} purchased${failureParts.length ? ` · ${failureParts.join(' · ')}` : ''} · ${money(total)} spent.`
    }
  }

  for (const group of transferGroups.values()) {
    const total = group.details.reduce((sum, event) => sum + (event.amountCents ?? 0), 0)
    group.description = `Government redistributed ${money(total)} across ${group.details.length} households.`
  }

  return displayed
}
