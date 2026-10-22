import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Set the profile in this child only, so local full runs and manual CI cannot inherit a reduced test selection.
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, ECON_TEST_PROFILE: 'pr' },
  stdio: 'inherit',
  windowsHide: true,
})
if (result.error) console.error(result.error.message)
process.exitCode = result.status ?? 1
