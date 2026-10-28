/// <reference lib="webworker" />
import { createValley, stepValley } from '../valley/engine'
import type { ValleyConfig, ValleyState } from '../valley/types'
import { changeOf, wireOf, type Wire } from './viewCopy'
import type { EngineMessage, PageMessage } from './engineLink'

/**
 * The engine's thread. It builds the valley from the run's settings, as the page does, then runs towards the goal the
 * page last gave in slices of at most `SLICE_MS`, sending a view copy every `stride` minutes and at the end of each
 * slice. Messages are read between slices, so a new goal or followed person takes effect within one.
 */
const SLICE_MS = 50

let state: ValleyState | null = null
/** The last copy sent, which the page also holds. */
let sent: Wire | null = null
let goal = 0
let stride = 1
let followedId = 0
let running = false

const post = (message: EngineMessage) => postMessage(message)

function send() {
  const wire = wireOf(state!, followedId, sent)
  post({ kind: 'state', change: changeOf(wire, sent) })
  sent = wire
}

function run() {
  running = false
  if (!state) return
  const started = performance.now()
  try {
    while (state.minute < goal) {
      const before = state.minute
      state = stepValley(state, Math.min(goal, before + stride), () => performance.now() - started >= SLICE_MS)
      send()
      if (performance.now() - started >= SLICE_MS) break
    }
  } catch (error) {
    post({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    return
  }
  if (state.minute < goal) schedule()
}

/** Runs again once waiting messages are read. */
function schedule() {
  if (running) return
  running = true
  setTimeout(run, 0)
}

function start(config: Partial<ValleyConfig>) {
  state = createValley(config)
  sent = wireOf(state, followedId)
  goal = Math.max(goal, state.minute)
  post({ kind: 'ready' })
  schedule()
}

onmessage = (event: MessageEvent<PageMessage>) => {
  const message = event.data
  if (message.kind === 'start') {
    try {
      start(message.config)
    } catch (error) {
      post({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    return
  }
  const followed = message.followedId !== followedId
  goal = Math.max(goal, message.goal)
  stride = message.stride
  followedId = message.followedId
  if (!state) return
  if (followed) send()
  schedule()
}
