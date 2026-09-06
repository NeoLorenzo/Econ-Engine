import { chromium } from 'playwright'

const APP_URL = process.env.ECON_ENGINE_PREVIEW_URL ?? 'http://127.0.0.1:4173/'
const PAUSE_TIMEOUT_MS = 2000
const MAX_PAUSE_LATENCY_MS = 1500

const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(APP_URL, { waitUntil: 'networkidle' })

  const speed = page.getByLabel('Speed')
  await speed.selectOption('100')
  await page.getByRole('button', { name: 'Run simulation' }).click()

  await page.waitForFunction(() => {
    const text = document.querySelector('.control-day')?.textContent ?? ''
    return Number(text.match(/\d+/)?.[0] ?? 0) >= 5
  }, null, { timeout: 5000 })

  const householdText = await page.locator('.header-context').textContent()
  if (!householdText?.includes('100 households')) {
    throw new Error(`Expected canonical N=100, got: ${householdText}`)
  }

  const beforePauseText = await page.locator('.control-day').textContent()
  const beforePauseDay = Number(beforePauseText?.match(/\d+/)?.[0] ?? 0)

  const startedAt = Date.now()
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.waitForFunction(
    () => document.querySelector('.run-indicator')?.textContent === 'Paused',
    null,
    { timeout: PAUSE_TIMEOUT_MS },
  )
  const pauseLatencyMs = Date.now() - startedAt

  const pausedText = await page.locator('.control-day').textContent()
  const pausedDay = Number(pausedText?.match(/\d+/)?.[0] ?? 0)

  await page.waitForTimeout(350)
  const laterText = await page.locator('.control-day').textContent()
  const laterDay = Number(laterText?.match(/\d+/)?.[0] ?? 0)

  if (pauseLatencyMs > MAX_PAUSE_LATENCY_MS) {
    throw new Error(`Pause took ${pauseLatencyMs}ms, expected <= ${MAX_PAUSE_LATENCY_MS}ms`)
  }
  if (laterDay !== pausedDay) {
    throw new Error(`Simulation advanced after Pause: day ${pausedDay} -> ${laterDay}`)
  }
  if (pausedDay < beforePauseDay) {
    throw new Error(`Visible day regressed during Pause: ${beforePauseDay} -> ${pausedDay}`)
  }

  console.log(JSON.stringify({
    householdCount: 100,
    beforePauseDay,
    pausedDay,
    pauseLatencyMs,
    laterDay,
  }))
} finally {
  await browser.close()
}
