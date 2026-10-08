import type { SimulationState } from '../../sim/types'
import { Icon } from '../components'
import { CONSUMER_INDUSTRIES, householdCashSteps } from '../economyModel'
import { entityName, firmName, firmShortName, INDUSTRY_NAMES, money } from '../format'
import { selectedEntityKind, type WorldFocus } from '../shell/navigation'
import {
  getHouseholdChoiceObservation,
  type CompetitiveIndustryId,
  type HouseholdChoiceObservation,
  type LinkMode,
} from '../worldViewModel'

/** "Firm A is 3 tiles away, Firm B 7" */
const distanceSummary = (distancesByFirmId: Record<string, number>) =>
  Object.entries(distancesByFirmId)
    .map(([firmId, distance], index) =>
      index === 0 ? `${firmShortName(firmId)} is ${distance} tiles away` : `${firmShortName(firmId)} ${distance}`,
    )
    .join(', ')

function outcomeLabel(outcome: HouseholdChoiceObservation['outcome']) {
  if (outcome === 'purchased') return 'Bought'
  if (outcome === 'insufficient_funds') return "Couldn't afford"
  if (outcome === 'stockout') return 'Sold out'
  return 'Not yet'
}

function HouseholdInspector({
  state,
  householdId,
  industry,
  onIndustry,
  onSelect,
}: {
  state: SimulationState
  householdId: string
  industry: CompetitiveIndustryId
  onIndustry: (industry: CompetitiveIndustryId) => void
  onSelect: (id: string) => void
}) {
  const household = state.households.find(({ id }) => id === householdId)!
  const choices = CONSUMER_INDUSTRIES.map((id) => getHouseholdChoiceObservation(state, householdId, id))
  const active = choices.find((choice) => choice.industryId === industry)!
  const unpaid = household.unpaidWageTodayCents
  return (
    <>
      <p className="inspector-sub">
        Works at{' '}
        <button type="button" className="link" onClick={() => onSelect(household.employerFirmId)}>
          {firmName(household.employerFirmId)}
        </button>
      </p>
      <h4>Where its cash went today</h4>
      <ol className="cash-steps">
        {householdCashSteps(household).map((step) => (
          <li key={step.label} className={`cash-step cash-step--${step.kind}`}>
            <span>
              {step.label}
              {step.label === 'Wage' && unpaid > 0 && <small> ({money(unpaid)} short)</small>}
            </span>
            <span className="num">
              {step.kind === 'in' ? '+' : step.kind === 'out' ? '−' : ''}
              {money(step.amountCents)}
            </span>
          </li>
        ))}
      </ol>
      <h4>Today's purchases</h4>
      <ul className="purchase-list">
        {choices.map((choice) => (
          <li key={choice.industryId}>
            <button
              type="button"
              aria-pressed={choice.industryId === industry}
              onClick={() => onIndustry(choice.industryId)}
            >
              <span>{INDUSTRY_NAMES[choice.industryId]}</span>
              <span className={`outcome outcome--${choice.outcome}`}>
                {choice.chosenFirmId ? firmShortName(choice.chosenFirmId) : outcomeLabel(choice.outcome)}
              </span>
              <span className="num">{choice.deliveredCostCents === null ? '—' : money(choice.deliveredCostCents)}</span>
            </button>
          </li>
        ))}
      </ul>
      {active.chosenFirmId && (
        <p className="inspector-note">
          {INDUSTRY_NAMES[industry]}: paid {money(active.productPriceCents ?? 0)} +{' '}
          {money(active.transportFeeCents ?? 0)} transport for a {active.roundTripTiles}-tile round trip to{' '}
          {firmShortName(active.chosenFirmId)}. {distanceSummary(active.distancesByFirmId ?? {})}.
        </p>
      )}
    </>
  )
}

function FirmInspector({
  state,
  firmId,
  linkMode,
  onSelect,
}: {
  state: SimulationState
  firmId: string
  linkMode: LinkMode
  onSelect: (id: string) => void
}) {
  const firm = state.firms.find(({ id }) => id === firmId)!
  const market = state.metrics.at(-1)?.markets.find((item) => item.firmId === firmId)
  const isTransport = firm.industryId === 'transport'
  return (
    <>
      <p className="inspector-sub">
        {isTransport
          ? 'Monopoly · has no location, so it sits off the grid'
          : `Competes in ${INDUSTRY_NAMES[firm.industryId]}`}
      </p>
      <dl className="inspector-stats">
        <div>
          <dt>{isTransport ? 'Rate' : 'Price'}</dt>
          <dd>
            {isTransport
              ? `${money(state.config.transportCostPerTileCents ?? 0)}/tile`
              : money(market?.postedPriceCents ?? firm.postedPriceCents)}
          </dd>
        </div>
        <div>
          <dt>{isTransport ? 'Trips sold' : 'Share'}</dt>
          <dd>{isTransport ? firm.unitsSoldToday : `${Math.round((market?.marketShare ?? 0) * 100)}%`}</dd>
        </div>
        <div>
          <dt>Revenue</dt>
          <dd>{money(firm.revenueTodayCents)}</dd>
        </div>
        <div>
          <dt>Wages paid</dt>
          <dd>{Math.round(firm.payrollFulfillmentRate * 100)}%</dd>
        </div>
      </dl>
      {!isTransport && (
        <p className="inspector-note">
          Sold {firm.unitsSoldToday} of {firm.unitsProducedToday} units made today. Tomorrow's price:{' '}
          {money(firm.postedPriceCents)}.
        </p>
      )}
      <h4>
        {firm.employeeIds.length} workers{' '}
        {linkMode !== 'jobs' && <span className="muted">· switch to Jobs to see links</span>}
      </h4>
      <div className="worker-grid">
        {firm.employeeIds.map((workerId) => (
          <button type="button" key={workerId} onClick={() => onSelect(workerId)}>
            {workerId.replace('household-', 'H')}
          </button>
        ))}
      </div>
    </>
  )
}

/** Details for the selected household or firm. Renders nothing when the selection names nothing in this run. */
export function Inspector({
  state,
  focus,
  onSelect,
  onIndustry,
}: {
  state: SimulationState
  focus: WorldFocus
  onSelect: (id: string | null) => void
  onIndustry: (industry: CompetitiveIndustryId) => void
}) {
  const { selectedId, industry, linkMode } = focus
  const kind = selectedEntityKind(state, selectedId)
  if (!selectedId || !kind) return null
  return (
    <aside className="inspector" aria-live="polite" aria-label="Selection details">
      <header>
        <h3>{entityName(selectedId)}</h3>
        <button type="button" className="icon-button" aria-label="Close details" onClick={() => onSelect(null)}>
          <Icon name="close" />
        </button>
      </header>
      {kind === 'household' && (
        <HouseholdInspector
          state={state}
          householdId={selectedId}
          industry={industry}
          onIndustry={onIndustry}
          onSelect={onSelect}
        />
      )}
      {kind === 'firm' && <FirmInspector state={state} firmId={selectedId} linkMode={linkMode} onSelect={onSelect} />}
      <p className="inspector-foot">
        {linkMode === 'purchases'
          ? 'Dashed line: who this household bought from in the selected market.'
          : 'Green lines: employment links.'}{' '}
        Lines show relationships, not travel routes.
      </p>
    </aside>
  )
}
