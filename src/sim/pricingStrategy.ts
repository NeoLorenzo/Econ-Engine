import { MIN_PRICE_CENTS } from './config'
import type { Direction, PriceDecision, PricingState } from './types'

export interface PricingExplorationDraw {
  shouldProbe: boolean
  direction: Direction
}

const move = (price: number, direction: Direction, step: number) =>
  Math.max(MIN_PRICE_CENTS, price + (direction === 'up' ? step : -step))

const opposite = (direction: Direction): Direction => (direction === 'up' ? 'down' : 'up')

export function createPricingState(startingPriceCents: number, initialStepCents: number): PricingState {
  return {
    bestPriceCents: startingPriceCents,
    bestProfitCents: -1,
    stepSizeCents: Math.max(1, initialStepCents),
    direction: 'up',
    converged: false,
    foundPositiveProfit: false,
    testedLowerAtOneCent: false,
    testedUpperAtOneCent: false,
    incumbentPriceCents: startingPriceCents,
    incumbentProfitCents: -1,
    locallySettled: false,
    probing: false,
    probeDirection: null,
  }
}

export function decideTomorrowPrice(
  state: PricingState,
  currentPriceCents: number,
  unitsSold: number,
  currentProfitCents: number,
  exploration: PricingExplorationDraw = { shouldProbe: false, direction: 'up' },
): PriceDecision {
  const next = { ...state }
  if (next.probing) {
    const adopted = currentProfitCents > next.incumbentProfitCents
    if (adopted) {
      next.incumbentPriceCents = currentPriceCents
      next.incumbentProfitCents = currentProfitCents
      next.bestPriceCents = currentPriceCents
      next.bestProfitCents = currentProfitCents
    }
    next.probing = false
    next.probeDirection = null
    return {
      nextPriceCents: next.incumbentPriceCents,
      state: next,
      action: adopted ? 'probe_adopted' : 'probe_rejected',
      justConverged: false,
      probeEvent: adopted ? 'adopted' : 'rejected',
      reason: adopted
        ? 'The one-cent probe improved realized profit, so it becomes the new incumbent price.'
        : 'The one-cent probe did not improve realized profit, so the incumbent price is restored.',
    }
  }

  if (next.locallySettled || next.converged) {
    next.locallySettled = true
    next.converged = true
    if (exploration.shouldProbe) {
      let direction = exploration.direction
      if (next.incumbentPriceCents === MIN_PRICE_CENTS && direction === 'down') direction = 'up'
      next.probing = true
      next.probeDirection = direction
      const probePrice = move(next.incumbentPriceCents, direction, 1)
      return {
        nextPriceCents: probePrice,
        state: next,
        action: 'probe_started',
        justConverged: false,
        probeEvent: 'started',
        reason: `Starting an independently sampled one-cent ${direction} probe from the incumbent price.`,
      }
    }
    return { nextPriceCents: next.incumbentPriceCents, state: next, action: 'hold', justConverged: false, reason: 'Locally settled. Holding the incumbent price until a future probe is sampled.' }
  }

  if (!next.foundPositiveProfit && currentProfitCents === 0 && unitsSold === 0) {
    next.direction = 'down'
    const candidate = move(currentPriceCents, 'down', next.stepSizeCents)
    return {
      nextPriceCents: candidate,
      state: next,
      action: 'decrease',
      justConverged: false,
      reason: `No sale has been found yet. Lowering the experimental price by ${next.stepSizeCents}¢ to search for demand.`,
    }
  }

  if (currentProfitCents > next.bestProfitCents) {
    next.bestPriceCents = currentPriceCents
    next.bestProfitCents = currentProfitCents
    next.foundPositiveProfit = currentProfitCents > 0
    next.testedLowerAtOneCent = false
    next.testedUpperAtOneCent = false
    if (state.bestProfitCents < 0 || !state.foundPositiveProfit) next.direction = 'up'
    return {
      nextPriceCents: move(next.bestPriceCents, next.direction, next.stepSizeCents),
      state: next,
      action: next.direction === 'up' ? 'increase' : 'decrease',
      justConverged: false,
      reason: `This experiment improved realized profit. Continuing ${next.direction} by ${next.stepSizeCents}¢ from the new best price.`,
    }
  }

  if (next.stepSizeCents > 1) {
    next.stepSizeCents = Math.max(1, Math.floor(next.stepSizeCents / 2))
    next.direction = opposite(next.direction)
    return {
      nextPriceCents: move(next.bestPriceCents, next.direction, next.stepSizeCents),
      state: next,
      action: 'refine',
      justConverged: false,
      reason: `The experiment did not beat the best realized profit. Returning around the best price, reversing direction, and narrowing the step to ${next.stepSizeCents}¢.`,
    }
  }

  if (currentPriceCents < next.bestPriceCents) next.testedLowerAtOneCent = true
  if (currentPriceCents > next.bestPriceCents) next.testedUpperAtOneCent = true

  if (next.testedLowerAtOneCent && next.testedUpperAtOneCent) {
    next.converged = true
    next.locallySettled = true
    next.incumbentPriceCents = next.bestPriceCents
    next.incumbentProfitCents = next.bestProfitCents
    return {
      nextPriceCents: next.bestPriceCents,
      state: next,
      action: 'locally_settled',
      justConverged: true,
      reason: 'Both adjacent one-cent prices failed to improve realized profit. The learner is locally settled and will keep testing occasional probes.',
    }
  }

  const direction: Direction = next.testedLowerAtOneCent ? 'up' : 'down'
  next.direction = direction
  return {
    nextPriceCents: move(next.bestPriceCents, direction, 1),
    state: next,
    action: 'refine',
    justConverged: false,
    reason: `Testing the remaining one-cent neighbor ${direction} from the best-known price.`,
  }
}
