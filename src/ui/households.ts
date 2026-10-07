import type { SimulationState } from '../sim/types'

export type HouseholdSort = 'household' | 'employer' | 'cash' | 'contract' | 'wage' | 'unpaid' | 'tax' | 'transfer' | 'net'

type Household = SimulationState['households'][number]

export function filterAndSortHouseholds(households: Household[], query: string, sort: HouseholdSort, ascending: boolean): Household[] {
  const needle = query.trim().toLowerCase()
  const value = (household: Household) => ({
    household: Number(household.id.split('-').at(-1)),
    employer: household.employerFirmId,
    cash: household.postFiscalCashCents,
    contract: household.contractualWageTodayCents,
    wage: household.wageTodayCents,
    unpaid: household.unpaidWageTodayCents,
    tax: household.taxPaidTodayCents,
    transfer: household.transferReceivedTodayCents,
    net: household.netCashChangeTodayCents,
  })[sort]
  return households
    .filter((household) => !needle || household.id.toLowerCase().includes(needle) || household.employerFirmId.toLowerCase().includes(needle))
    .sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      const result = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv)
      return (result || a.id.localeCompare(b.id, undefined, { numeric: true })) * (ascending ? 1 : -1)
    })
}
