import { useEffect, useRef, type ReactNode } from 'react'
import { DEFAULT_INDUSTRIES } from '../sim/config'
import { Icon, InfoTip } from './components'
import { DEFAULT_SETTINGS_DRAFT, parseSimulationSettings, type SimulationSettingsDraft } from './simulationSettings'

const CONSUMER = DEFAULT_INDUSTRIES.filter(({ id }) => id !== 'transport')

function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return <label className={`field${error ? ' field--invalid' : ''}`}>
    <span className="field-label">{label}{hint && <InfoTip label={`About ${label}`}>{hint}</InfoTip>}</span>
    {children}
    {error && <span className="field-error">{error}</span>}
  </label>
}

function MoneyInput({ value, onChange, label, invalid, describedBy }: { value: string; onChange: (value: string) => void; label: string; invalid: boolean; describedBy?: string }) {
  return <span className="money-input">
    <span aria-hidden="true">$</span>
    <input inputMode="decimal" aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy} value={value} onChange={(event) => onChange(event.target.value)} />
  </span>
}

export function SettingsDrawer({ open, draft, onDraft, onApply, onClose }: {
  open: boolean
  draft: SimulationSettingsDraft
  onDraft: (draft: SimulationSettingsDraft) => void
  onApply: () => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const parsed = parseSimulationSettings(draft)
  const errors = parsed.ok ? [] : parsed.errors
  const errorFor = (field: string) => errors.find((error) => error.field === field)?.message

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const set = (patch: Partial<SimulationSettingsDraft>) => onDraft({ ...draft, ...patch })
  const setFirm = (firmId: string, value: string) => onDraft({ ...draft, firmStarts: { ...draft.firmStarts, [firmId]: value } })

  return <dialog ref={dialogRef} className="drawer" aria-labelledby="settings-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <form method="dialog" className="drawer-body" onSubmit={(event) => { event.preventDefault(); if (parsed.ok) onApply() }}>
      <header className="drawer-head">
        <div>
          <h2 id="settings-title">Scenario</h2>
          <p>Change the starting conditions. Applying restarts the economy from day 0.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}><Icon name="close" /></button>
      </header>

      <fieldset>
        <legend>World</legend>
        <Field label="Random seed" error={errorFor('seed')} hint="Decides where households and firms are placed, who works where, and every random choice. The same seed always replays the same economy.">
          <span className="seed-input">
            <input inputMode="numeric" aria-invalid={Boolean(errorFor('seed')) || undefined} value={draft.seed} onChange={(event) => set({ seed: event.target.value })} />
            <button type="button" className="secondary" onClick={() => set({ seed: String(1 + Math.floor(Math.random() * 4_294_967_294)) })}>Shuffle</button>
          </span>
        </Field>
        <Field label="Transport cost per tile" error={errorFor('transportRate')} hint="What households pay per tile of the round trip to a shop. Higher costs make distance matter more than price.">
          <MoneyInput label="Transport cost per tile" value={draft.transportRate} invalid={Boolean(errorFor('transportRate'))} onChange={(value) => set({ transportRate: value })} />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Households</legend>
        <Field label="Daily spending budget" error={errorFor('expenditureBase')} hint="Each household splits this across the four markets by fixed shares (food 12.9%, utilities 6%, healthcare 7.9%, entertainment 4.6%).">
          <MoneyInput label="Daily spending budget" value={draft.expenditureBase} invalid={Boolean(errorFor('expenditureBase'))} onChange={(value) => set({ expenditureBase: value })} />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Firms</legend>
        <Field label="Price-learning step" error={errorFor('step')} hint="How far a firm moves its price while it is still searching. Smaller steps search more carefully but more slowly.">
          <MoneyInput label="Price-learning step" value={draft.step} invalid={Boolean(errorFor('step'))} onChange={(value) => set({ step: value })} />
        </Field>
        <div className="field-label">Starting prices</div>
        <div className="price-grid" role="group" aria-label="Starting prices">
          <span /><span className="price-grid-head"><i className="firm-dot firm-dot--a" />Firm A</span><span className="price-grid-head"><i className="firm-dot firm-dot--b" />Firm B</span>
          {CONSUMER.map((industry) => <div className="price-grid-row" key={industry.id}>
            <span>{industry.name}</span>
            {(['a', 'b'] as const).map((suffix) => {
              const firmId = `firm-${industry.id}-${suffix}`
              const error = errorFor(firmId)
              return <MoneyInput key={firmId} label={`${industry.name} Firm ${suffix.toUpperCase()} starting price`} value={draft.firmStarts[firmId] ?? '2.00'} invalid={Boolean(error)} describedBy={error ? `error-${firmId}` : undefined} onChange={(value) => setFirm(firmId, value)} />
            })}
          </div>)}
        </div>
        {CONSUMER.flatMap((industry) => (['a', 'b'] as const).map((suffix) => `firm-${industry.id}-${suffix}`)).filter((firmId) => errorFor(firmId)).map((firmId) =>
          <p className="field-error" key={firmId} id={`error-${firmId}`}>{errors.find((error) => error.field === firmId)!.label}: {errorFor(firmId)}</p>)}
      </fieldset>

      <footer className="drawer-foot">
        <button type="button" className="ghost" onClick={() => onDraft(DEFAULT_SETTINGS_DRAFT)}>Restore defaults</button>
        <button type="submit" className="primary" disabled={!parsed.ok}>Apply &amp; restart</button>
      </footer>
    </form>
  </dialog>
}
