import { MIN_PRICE_CENTS } from './config'
import type { Direction, PriceDecision, PricingState } from './types'

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
  }
}

export function decideTomorrowPrice(
  state: PricingState,
  currentPriceCents: number,
  unitsSold: number,
  currentProfitCents: number,
): PriceDecision {
  const next = { ...state }
  if (next.converged) {
    return { nextPriceCents: next.bestPriceCents, state: next, action: 'hold', justConverged: false, reason: 'Price discovery is complete. Holding the best-known price.' }
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
    return {
      nextPriceCents: next.bestPriceCents,
      state: next,
      action: 'converged',
      justConverged: true,
      reason: 'Both adjacent one-cent prices failed to improve realized profit. Holding the best-known price.',
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
