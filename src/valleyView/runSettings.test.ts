import { describe, expect, it } from 'vitest'
import { VALLEY_DEFAULT_CONFIG } from '../valley/config'
import { configOfSettings, defaultRunSettings, runSettingsError } from './runSettings'

describe('run settings', () => {
  const settings = defaultRunSettings()

  it('give the default configuration at their defaults', () => {
    expect({ ...VALLEY_DEFAULT_CONFIG, ...configOfSettings(settings) }).toEqual(VALLEY_DEFAULT_CONFIG)
    expect(settings).toMatchObject({ worldKm: 4, founders: 40, daysPerYear: 90 })
  })

  it('reject values outside their ranges and fractions', () => {
    expect(runSettingsError({ ...settings, daysPerYear: 7 })).toBe('Days per year must be from 8 to 365')
    expect(runSettingsError({ ...settings, daysPerYear: 366 })).toBe('Days per year must be from 8 to 365')
    expect(runSettingsError({ ...settings, worldKm: 0 })).toBe('World size, km must be from 1 to 10')
    expect(runSettingsError({ ...settings, worldKm: 11 })).toBe('World size, km must be from 1 to 10')
    expect(runSettingsError({ ...settings, founders: 101 })).toBe('Founders must be from 1 to 100')
    expect(runSettingsError({ ...settings, founders: 2.5 })).toBe('Founders must be a whole number')
    expect(runSettingsError({ ...settings, seed: Number.NaN })).toBe('Seed must be a whole number')
  })

  it('scale places and landforms with the area of the world', () => {
    const small = configOfSettings({ ...settings, worldKm: 1 })
    expect(small).toMatchObject({ valleySizeCm: 100_000, thicketCount: 50, standCount: 19, moraineBeltCount: 1 })
  })

  it('accept the smallest and shortest-year world', () => {
    expect(runSettingsError({ ...settings, worldKm: 1, daysPerYear: 8 })).toBeNull()
  })
})
