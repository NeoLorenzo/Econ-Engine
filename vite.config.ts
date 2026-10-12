import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      // The MVP9 observer, the Life 5 valley and the hourly Life 4 are separate pages, relative to the project root.
      input: { main: 'index.html', life: 'life.html', life4: 'life4.html' },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The Life and valley experiments run in parallel and load every core, so a test that takes a second alone can
    // take several in the full suite. The default of 5 seconds failed tests that were only slowed down.
    testTimeout: 60_000,
  },
})
