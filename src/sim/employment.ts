import { normalizeSeed, seededShuffle } from './rng'

export const deriveEmploymentSeed = (masterSeed: number) => normalizeSeed((normalizeSeed(masterSeed) ^ 0x85ebca6b) >>> 0)

export function assignEmployment(masterSeed: number, householdIds: readonly string[], firmIds: readonly string[]) {
  const slots = [...firmIds.filter((id) => id !== 'firm-transport').sort(), 'firm-transport', 'firm-transport']
  if (slots.length !== householdIds.length) throw new Error('Employment slots must exactly match households')
  const workers = [...householdIds].sort()
  const assignment = seededShuffle(workers, deriveEmploymentSeed(masterSeed)).values
  return Object.fromEntries(assignment.map((householdId, index) => [householdId, slots[index]])) as Record<string, string>
}

export function payrollOrder(masterSeed: number, day: number, firmId: string, employeeIds: readonly string[]) {
  let hash = deriveEmploymentSeed(masterSeed) ^ Math.imul(day, 0x27d4eb2d)
  for (const character of firmId) hash = Math.imul(hash ^ character.charCodeAt(0), 0x45d9f3b)
  return seededShuffle([...employeeIds].sort(), normalizeSeed(hash >>> 0)).values
}
