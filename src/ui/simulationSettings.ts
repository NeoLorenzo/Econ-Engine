import {
  DEFAULT_FIRM_IDS_BY_INDUSTRY,
  DEFAULT_INDUSTRIES,
  DEFAULT_SEED,
  DEFAULT_TRANSPORT_COST_PER_TILE_CENTS,
  consumerFirmIds,
} from '../sim/config'
import type { SimulationConfig } from '../sim/types'

export interface SimulationSettingsDraft {
  seed: string
  expenditureBase: string
  transportRate: string
  step: string
  firmStarts: Record<string, string>
}

export interface SettingsError {
  field: string
  label: string
  message: string
}

export type SettingsParseResult = { ok: true; config: SimulationConfig } | { ok: false; errors: SettingsError[] }

export const DEFAULT_SETTINGS_DRAFT: SimulationSettingsDraft = {
  seed: String(DEFAULT_SEED),
  expenditureBase: '50.00',
  transportRate: (DEFAULT_TRANSPORT_COST_PER_TILE_CENTS / 100).toFixed(2),
  step: '1.00',
  firmStarts: Object.fromEntries(consumerFirmIds(DEFAULT_FIRM_IDS_BY_INDUSTRY).map((firmId) => [firmId, '2.00'])),
}

const MAXIMUM_SEED = 0xffff_ffff
const DOLLAR_AMOUNT = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/

/** Parses whole cents exactly from text, so a typed amount is never rounded or replaced. */
function parseCents(raw: string, minimumCents: number): { cents: number } | { message: string } {
  const text = raw.trim()
  if (!text) return { message: 'Enter an amount.' }
  if (!DOLLAR_AMOUNT.test(text))
    return { message: 'Use a dollar amount with at most two decimal places, such as 2.00.' }
  const [whole, fraction = ''] = text.split('.')
  const cents = Number(whole || 0) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return { message: 'Amount is too large.' }
  if (cents < minimumCents) return { message: `Must be at least $${(minimumCents / 100).toFixed(2)}.` }
  return { cents }
}

/** Seeds outside 1–4294967295 would be silently remapped by normalizeSeed, so they are rejected instead. */
function parseSeed(raw: string): { seed: number } | { message: string } {
  const text = raw.trim()
  if (!text) return { message: 'Enter a seed.' }
  const seed = /^\d+$/.test(text) ? Number(text) : NaN
  if (!Number.isInteger(seed) || seed < 1 || seed > MAXIMUM_SEED)
    return { message: `Use a whole number from 1 to ${MAXIMUM_SEED}.` }
  return { seed }
}

function firmLabel(firmId: string) {
  const [, industryId, suffix] = /^firm-(.+)-([a-z])$/.exec(firmId) ?? []
  const industry = DEFAULT_INDUSTRIES.find(({ id }) => id === industryId)
  return industry ? `${industry.name} Firm ${suffix.toUpperCase()} starting price` : `${firmId} starting price`
}

export function parseSimulationSettings(draft: SimulationSettingsDraft): SettingsParseResult {
  const errors: SettingsError[] = []
  const amount = (field: string, label: string, raw: string, minimumCents: number) => {
    const result = parseCents(raw, minimumCents)
    if ('message' in result) {
      errors.push({ field, label, message: result.message })
      return 0
    }
    return result.cents
  }
  const seedResult = parseSeed(draft.seed)
  if ('message' in seedResult) errors.push({ field: 'seed', label: 'Seed', message: seedResult.message })
  const dailyExpenditureBudgetCents = amount('expenditureBase', 'Daily expenditure base', draft.expenditureBase, 0)
  const transportCostPerTileCents = amount('transportRate', 'Transport cost per tile', draft.transportRate, 0)
  const initialStepCents = amount('step', 'Initial price-learning step', draft.step, 1)
  const firmStartingPricesCents = Object.fromEntries(
    Object.entries(draft.firmStarts).map(([firmId, raw]) => [firmId, amount(firmId, firmLabel(firmId), raw, 1)]),
  )
  if (errors.length > 0 || 'message' in seedResult) return { ok: false, errors }
  return {
    ok: true,
    config: {
      startingPriceCents: 200,
      firmStartingPricesCents,
      initialStepCents,
      laborProductivityUnitsPerWorker: 5,
      seed: seedResult.seed,
      transportCostPerTileCents,
      dailyExpenditureBudgetCents,
    },
  }
}
