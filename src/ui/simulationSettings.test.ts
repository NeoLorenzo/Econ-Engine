import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED } from '../sim/config'
import { DEFAULT_SETTINGS_DRAFT, parseSimulationSettings, type SimulationSettingsDraft } from './simulationSettings'

/** The pre-#28 App reset() parsing, kept here only to prove valid inputs map to the same config. */
const legacyConfig = (draft: SimulationSettingsDraft) => ({
  startingPriceCents: 200,
  firmStartingPricesCents: Object.fromEntries(Object.entries(draft.firmStarts).map(([firmId, value]) => [firmId, Math.max(1, Math.round(Number(value || 0) * 100))])),
  initialStepCents: Math.max(1, Math.round(Number(draft.step || 0) * 100)),
  laborProductivityUnitsPerWorker: 5,
  seed: Math.round(Number(draft.seed || DEFAULT_SEED)),
  transportCostPerTileCents: Math.max(0, Math.round(Number(draft.transportRate || 0) * 100)),
  dailyExpenditureBudgetCents: Math.max(0, Math.round(Number(draft.expenditureBase || 0) * 100)),
})

const withField = (field: string, value: string): SimulationSettingsDraft => field.startsWith('firm-')
  ? { ...DEFAULT_SETTINGS_DRAFT, firmStarts: { ...DEFAULT_SETTINGS_DRAFT.firmStarts, [field]: value } }
  : { ...DEFAULT_SETTINGS_DRAFT, [field]: value }

const errorFields = (draft: SimulationSettingsDraft) => {
  const result = parseSimulationSettings(draft)
  return result.ok ? [] : result.errors.map(({ field }) => field)
}

describe('[#28] simulation settings validation', () => {
  it('maps the default draft to the canonical configuration', () => {
    const result = parseSimulationSettings(DEFAULT_SETTINGS_DRAFT)
    expect(result.ok && result.config).toEqual(legacyConfig(DEFAULT_SETTINGS_DRAFT))
    expect(result.ok && result.config.seed).toBe(DEFAULT_SEED)
  })

  it('produces the same configuration as before for valid inputs', () => {
    const amounts = ['0.01', '1', '2.5', '.25', '12.34', ' 3.10 ', '007.00', '1.15', '1234.56']
    for (const amount of amounts) {
      const draft: SimulationSettingsDraft = { seed: '61', expenditureBase: amount, transportRate: amount, step: amount, firmStarts: { ...DEFAULT_SETTINGS_DRAFT.firmStarts, 'firm-food-a': amount } }
      const result = parseSimulationSettings(draft)
      expect(result.ok && result.config, amount).toEqual(legacyConfig(draft))
    }
    for (const seed of ['1', '42', '4294967295', String(DEFAULT_SEED)]) {
      const draft = withField('seed', seed)
      const result = parseSimulationSettings(draft)
      expect(result.ok && result.config.seed, seed).toBe(legacyConfig(draft).seed)
    }
  })

  it('accepts zero only where zero is meaningful', () => {
    expect(errorFields(withField('transportRate', '0'))).toEqual([])
    expect(errorFields(withField('expenditureBase', '0.00'))).toEqual([])
    expect(errorFields(withField('step', '0'))).toEqual(['step'])
    expect(errorFields(withField('firm-utilities-b', '0.00'))).toEqual(['firm-utilities-b'])
  })

  it('rejects non-numeric, empty, negative, malformed, and sub-cent amounts per field', () => {
    for (const field of ['expenditureBase', 'transportRate', 'step', 'firm-food-a', 'firm-entertainment-b']) {
      for (const value of ['abc', '', '   ', '-1', '1e2', '2.005', '1.2.3', '$2', 'NaN', 'Infinity', '.']) {
        expect(errorFields(withField(field, value)), `${field}=${JSON.stringify(value)}`).toEqual([field])
      }
    }
  })

  it('rejects seeds that would otherwise be silently remapped', () => {
    for (const value of ['abc', '', '0', '-5', '1.5', '4294967296', '1e3', ' ']) {
      expect(errorFields(withField('seed', value)), JSON.stringify(value)).toEqual(['seed'])
    }
  })

  it('reports every invalid field with a readable label and message', () => {
    const result = parseSimulationSettings({ ...DEFAULT_SETTINGS_DRAFT, seed: 'x', step: '', firmStarts: { ...DEFAULT_SETTINGS_DRAFT.firmStarts, 'firm-healthcare-a': 'abc' } })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.map(({ field }) => field)).toEqual(['seed', 'step', 'firm-healthcare-a'])
    expect(result.errors.find(({ field }) => field === 'firm-healthcare-a')?.label).toBe('Healthcare Firm A starting price')
    expect(result.errors.every(({ message }) => message.length > 0)).toBe(true)
  })
})
