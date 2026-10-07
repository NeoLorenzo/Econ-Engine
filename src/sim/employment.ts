import { TRANSPORT_FIRM_ID, TRANSPORT_WORKERS_PER_BLOCK } from './config'
import { normalizeSeed, seededShuffle } from './rng'

export const deriveEmploymentSeed = (masterSeed: number) =>
  normalizeSeed((normalizeSeed(masterSeed) ^ 0x85ebca6b) >>> 0)

/**
 * Fixed seeded jobs. Each employment block has one worker per consumer firm and two for Transport, so a population must
 * be a whole number of blocks (ten households in the canonical economy).
 */
export function assignEmployment(masterSeed: number, householdIds: readonly string[], firmIds: readonly string[]) {
  const consumerFirms = firmIds.filter((id) => id !== TRANSPORT_FIRM_ID).sort()
  const blockSize = consumerFirms.length + TRANSPORT_WORKERS_PER_BLOCK
  if (householdIds.length % blockSize !== 0)
    throw new Error(`Population must scale in complete ${blockSize}-household employment blocks`)
  const scale = householdIds.length / blockSize
  const slots = [
    ...consumerFirms.flatMap((id) => Array.from({ length: scale }, () => id)),
    ...Array.from({ length: scale * TRANSPORT_WORKERS_PER_BLOCK }, () => TRANSPORT_FIRM_ID),
  ]
  if (slots.length !== householdIds.length) throw new Error('Employment slots must exactly match households')
  const workers = [...householdIds].sort()
  const assignment = seededShuffle(workers, deriveEmploymentSeed(masterSeed)).values
  return Object.fromEntries(assignment.map((householdId, index) => [householdId, slots[index]])) as Record<
    string,
    string
  >
}

export function payrollOrder(masterSeed: number, day: number, firmId: string, employeeIds: readonly string[]) {
  let hash = deriveEmploymentSeed(masterSeed) ^ Math.imul(day, 0x27d4eb2d)
  for (const character of firmId) hash = Math.imul(hash ^ character.charCodeAt(0), 0x45d9f3b)
  return seededShuffle([...employeeIds].sort(), normalizeSeed(hash >>> 0)).values
}
