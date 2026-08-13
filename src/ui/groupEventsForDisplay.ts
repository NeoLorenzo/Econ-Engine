import type { SimulationEvent } from '../sim/types'

export interface DisplayEvent { key: string; day: number; type: string; description: string; details: SimulationEvent[]; grouped: boolean }
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

export function groupEventsForDisplay(events: SimulationEvent[]): DisplayEvent[] {
  const displayed: DisplayEvent[] = []
  const groups = new Map<string, DisplayEvent>()
  for (const event of events) {
    const isMarket = ['HOUSEHOLD_PURCHASE', 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS', 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT'].includes(event.type)
    const key = isMarket ? `market-${event.day}-${event.industryId}` : event.type === 'TRANSFER_RECEIVED' ? `redistribution-${event.day}` : ''
    if (key) {
      let group = groups.get(key)
      if (!group) {
        group = { key, day: event.day, type: isMarket ? `${event.industryId?.toUpperCase()} MARKET` : 'REDISTRIBUTION', description: '', details: [], grouped: true }
        groups.set(key, group); displayed.push(group)
      }
      group.details.push(event); continue
    }
    displayed.push({ key: `event-${event.id}`, day: event.day, type: event.type.replaceAll('_', ' '), description: event.description, details: [event], grouped: false })
  }
  for (const group of groups.values()) {
    if (group.key.startsWith('redistribution')) {
      const total = group.details.reduce((sum, event) => sum + (event.amountCents ?? 0), 0)
      group.description = `Government redistributed ${money(total)} across ${group.details.length} households.`
      continue
    }
    const purchases = group.details.filter(({ type }) => type === 'HOUSEHOLD_PURCHASE')
    const affordability = group.details.filter(({ type }) => type === 'HOUSEHOLD_PURCHASE_FAILED_INSUFFICIENT_FUNDS').length
    const stockouts = group.details.filter(({ type }) => type === 'HOUSEHOLD_PURCHASE_FAILED_STOCKOUT').length
    const spent = purchases.reduce((sum, event) => sum + (event.amountCents ?? 0), 0)
    group.description = `${purchases.length} purchased · ${affordability} affordability · ${stockouts} stockout failures · ${money(spent)} spent.`
  }
  return displayed
}
