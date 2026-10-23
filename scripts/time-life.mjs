import inspector from 'node:inspector'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createValley, stepValley } = await server.ssrLoadModule('/src/valley/engine.ts')
  const { routeNode } = await server.ssrLoadModule('/src/valley/routes.ts')
  const days = Number(process.argv[2] ?? 90)
  const start = performance.now()
  let state = createValley()
  const created = performance.now()
  const profiler = process.env.LIFE_PROFILE ? new inspector.Session() : null
  const call = (method) =>
    new Promise((resolve, reject) => profiler.post(method, (err, data) => (err ? reject(err) : resolve(data))))
  if (profiler) {
    profiler.connect()
    await call('Profiler.enable')
    await call('Profiler.start')
  }
  const timings = []
  for (let day = process.argv[3] === 'batch' ? days : 1; day <= days; day++) {
    const before = performance.now()
    state = stepValley(state, day * 1440)
    timings.push(performance.now() - before)
    if (process.env.LIFE_TRACE)
      console.log(
        JSON.stringify({
          day,
          ms: timings.at(-1),
          people: state.foragers.map((p) => ({
            id: p.id,
            alive: p.alive,
            water: p.waterDeficitMl,
            task: p.task?.kind,
            reason: p.task?.reason,
            x: p.x,
            y: p.y,
            banks: p.knownBanks.size,
            death: p.deathMinute,
          })),
          drinks: state.lastInterval.filter((e) => e.kind === 'drink').length,
        }),
      )
  }
  if (profiler) {
    const { profile } = await call('Profiler.stop')
    writeFileSync('.agent-logs/life12.cpu.json', JSON.stringify(profile))
    profiler.disconnect()
  }
  console.log(
    JSON.stringify({
      days,
      createMs: created - start,
      simulationSeconds: (performance.now() - created) / 1000,
      firstDayMs: timings[0],
      meanDayMs: timings.reduce((a, b) => a + b, 0) / days,
      wakeUps: state.totals.wakeUps,
      alive: state.foragers.filter((p) => p.alive).length,
      anchors: state.foragers.map((p) => ({
        id: p.id,
        known: routeNode(state.layout.lattice, p.knowledge, p),
        truth: routeNode(state.layout.lattice, { nodes: state.layout.lattice.dry, revision: 0 }, p),
      })),
      deaths: state.foragers
        .filter((p) => !p.alive)
        .map((p) => ({ id: p.id, minute: p.deathMinute, causes: p.deathCauses })),
      drinksMl: state.foragers.map((p) => p.waterDrunkMl),
    }),
  )
} finally {
  await server.close()
}
