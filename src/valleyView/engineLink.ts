import type { ValleyConfig, ValleyState } from '../valley/types'
import { applyChange, stateOf, wireOf, type Change, type Wire } from './viewCopy'

/** From the page to the engine's thread. */
export type PageMessage =
  { kind: 'start'; config: Partial<ValleyConfig> } | { kind: 'goal'; goal: number; stride: number; followedId: number }
/** From the engine's thread to the page. */
export type EngineMessage =
  { kind: 'ready' } | { kind: 'state'; change: Change | null } | { kind: 'error'; message: string }

/** The page's end of the engine's thread: it sends goals, and turns the copies received into states. */
export interface EngineLink {
  /** The first state, taken from the page's own build as the engine's thread takes it from its own. */
  first: ValleyState
  /** Settles once the engine's thread has built its valley. */
  ready: Promise<void>
  /** Asks the engine to run to `goal`, sending a state every `stride` minutes, with `followedId`'s memory current. */
  ask(goal: number, stride: number, followedId: number): void
  /** Calls `take` with each state the engine sends, in order, until the returned function is called. */
  listen(take: (state: ValleyState) => void): () => void
  stop(): void
}

/**
 * Starts the engine's thread on `config`. `start` is the page's own build of the same valley, from which the first
 * copy is taken; the engine's thread builds its own, and the two are equal because building is pure.
 */
export function startEngine(config: Partial<ValleyConfig>): (start: ValleyState) => EngineLink {
  const worker = new Worker(new URL('./engineWorker.ts', import.meta.url), { type: 'module' })
  const post = (message: PageMessage) => worker.postMessage(message)
  post({ kind: 'start', config })
  let wire: Wire | null = null
  let built = () => {}
  const pending: (Change | null)[] = []
  let listener: (state: ValleyState) => void = () => {}
  const link: EngineLink = {
    first: null!,
    ready: new Promise((resolve) => (built = resolve)),
    listen: (take) => {
      listener = take
      return () => {
        if (listener === take) listener = () => {}
      }
    },
    ask: (goal, stride, followedId) => post({ kind: 'goal', goal, stride, followedId }),
    stop: () => worker.terminate(),
  }
  const take = (change: Change | null) => {
    wire = applyChange(wire!, change)
    listener(stateOf(wire))
  }
  worker.addEventListener('message', (event: MessageEvent<EngineMessage>) => {
    const message = event.data
    if (message.kind === 'ready') built()
    else if (message.kind === 'error') {
      console.error(`The engine stopped: ${message.message}`)
      built()
    } else if (wire) take(message.change)
    else pending.push(message.change)
  })
  worker.addEventListener('error', (event) => console.error('The engine stopped:', event.message))
  return (start) => {
    wire = wireOf(start, 0)
    link.first = stateOf(wire)
    for (const change of pending.splice(0)) take(change)
    return link
  }
}
