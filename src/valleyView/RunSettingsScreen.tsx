import { useState, type FormEvent } from 'react'
import { RUN_SETTING_FIELDS, type RunSettings } from './runSettings'

const rangeLabel = (min?: number, max?: number) =>
  min === undefined || max === undefined
    ? 'any whole number'
    : `${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}`

/** How many simulated days a generation of 25 years takes at a year's length, as help beside the setting. */
const GENERATION_YEARS = 25
function generationLabel(text: string) {
  const days = Number(text)
  return Number.isInteger(days) && days > 0
    ? ` · a generation of ${GENERATION_YEARS} years is ${(days * GENERATION_YEARS).toLocaleString('en-US')} days`
    : ''
}

/** The settings screen: the run's settings with their ranges, and Start. */
export function RunSettingsScreen({
  initial,
  error,
  onStart,
}: {
  initial: RunSettings
  error: string | null
  onStart: (settings: RunSettings) => void
}) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(RUN_SETTING_FIELDS.map(({ key }) => [key, String(initial[key])])),
  )
  const [scattered, setScattered] = useState(initial.scattered)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const read = (text: string) => (text.trim() === '' ? Number.NaN : Number(text))
    onStart({
      ...(Object.fromEntries(RUN_SETTING_FIELDS.map(({ key }) => [key, read(draft[key]!)])) as Omit<
        RunSettings,
        'scattered'
      >),
      scattered,
    })
  }

  return (
    <div className="life-settings-page">
      <form className="life-settings" onSubmit={submit} aria-label="Run settings">
        <h1>Life 19 · generations</h1>
        <p className="life-note">Choose the run’s settings. They are fixed once it starts; New run comes back here.</p>
        {RUN_SETTING_FIELDS.map(({ key, label, min, max }) => (
          <label key={key}>
            <span>{label}</span>
            <input
              inputMode="numeric"
              value={draft[key]}
              onChange={(change) => setDraft({ ...draft, [key]: change.target.value })}
            />
            <small>
              {rangeLabel(min, max)}
              {key === 'daysPerYear' && generationLabel(draft[key]!)}
            </small>
          </label>
        ))}
        <label className="life-switch">
          <input type="checkbox" checked={scattered} onChange={(change) => setScattered(change.target.checked)} />
          Start scattered (otherwise together round one camp)
        </label>
        {error && (
          <p className="life-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary">
          Start
        </button>
      </form>
    </div>
  )
}
