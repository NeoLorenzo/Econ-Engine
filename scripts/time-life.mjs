// Usage: node scripts/time-life.mjs [days=90] [batch|daily]
// Initialisation is timed separately. No rendering or invariant checking is included.
import { createServer } from 'vite'
const days = Number(process.argv[2] ?? 90),
  mode = process.argv[3] ?? 'batch'
if (!Number.isInteger(days) || days < 1 || !['batch', 'daily'].includes(mode))
  throw new Error('Use a positive integer day count and batch or daily')
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createValley, stepValley } = await server.ssrLoadModule('/src/valley/engine.ts')
  const started = performance.now()
  let state = createValley()
  const created = performance.now(),
    timings = []
  if (mode === 'batch') {
    const before = performance.now()
    state = stepValley(state, days * 1440)
    timings.push(performance.now() - before)
  } else
    for (let day = 1; day <= days; day++) {
      const before = performance.now()
      state = stepValley(state, day * 1440)
      timings.push(performance.now() - before)
    }
  const simulationMs = timings.reduce((a, b) => a + b, 0)
  console.log(
    JSON.stringify({
      days,
      mode,
      createMs: created - started,
      simulationSeconds: simulationMs / 1000,
      meanDayMs: simulationMs / days,
      ...(mode === 'daily' || days === 1 ? { firstDayMs: timings[0] } : {}),
      wakeUps: state.totals.wakeUps,
      alive: state.foragers.filter((p) => p.alive).length,
      deaths: state.foragers
        .filter((p) => !p.alive)
        .map((p) => ({ id: p.id, minute: p.deathMinute, causes: p.deathCauses })),
    }),
  )
} finally {
  await server.close()
}
