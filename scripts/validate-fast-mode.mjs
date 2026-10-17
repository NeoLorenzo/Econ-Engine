import { chromium } from 'playwright'

const APP_URL = process.env.ECON_ENGINE_PREVIEW_URL ?? 'http://127.0.0.1:4173/'
const PAUSE_TIMEOUT_MS = 2000
const MAX_PAUSE_LATENCY_MS = 1500
// One pause on a shared CI runner is noisy, so the check pauses several times and judges the median.
const TRIALS = 5
// Each trial lets the simulation run at least this many days before pausing it.
const DAYS_PER_TRIAL = 3

const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(APP_URL, { waitUntil: 'networkidle' })

  const householdText = await page.locator('.scenario-summary').textContent()
  if (!householdText?.includes('100 households')) {
    throw new Error(`Expected canonical N=100, got: ${householdText}`)
  }

  const visibleDay = async () => Number((await page.locator('.control-day').textContent())?.match(/\d+/)?.[0] ?? 0)
  await page.getByLabel('Speed').selectOption('100')

  const trials = []
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const startDay = await visibleDay()
    await page.getByRole('button', { name: 'Run simulation' }).click()
    await page.waitForFunction(
      (target) => Number(document.querySelector('.control-day')?.textContent?.match(/\d+/)?.[0] ?? 0) >= target,
      startDay + DAYS_PER_TRIAL,
      { timeout: 5000 },
    )
    const beforePauseDay = await visibleDay()

    const startedAt = Date.now()
    await page.getByRole('button', { name: 'Pause' }).click()
    await page.waitForFunction(() => document.querySelector('.run-indicator')?.textContent === 'Paused', null, {
      timeout: PAUSE_TIMEOUT_MS,
    })
    const pauseLatencyMs = Date.now() - startedAt

    const pausedDay = await visibleDay()
    await page.waitForTimeout(350)
    const laterDay = await visibleDay()

    if (laterDay !== pausedDay) throw new Error(`Simulation advanced after Pause: day ${pausedDay} -> ${laterDay}`)
    if (pausedDay < beforePauseDay)
      throw new Error(`Visible day regressed during Pause: ${beforePauseDay} -> ${pausedDay}`)
    trials.push({ beforePauseDay, pausedDay, pauseLatencyMs })
  }

  const latencies = trials.map(({ pauseLatencyMs }) => pauseLatencyMs).sort((a, b) => a - b)
  const medianLatencyMs = latencies[Math.floor(latencies.length / 2)]
  console.log(JSON.stringify({ householdCount: 100, trials, medianLatencyMs }))
  if (medianLatencyMs > MAX_PAUSE_LATENCY_MS) {
    throw new Error(`Pause took ${medianLatencyMs}ms at the median of ${TRIALS}, expected <= ${MAX_PAUSE_LATENCY_MS}ms`)
  }
} finally {
  await browser.close()
}
