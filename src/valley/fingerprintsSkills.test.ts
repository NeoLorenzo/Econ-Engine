import { checkFingerprints } from './fingerprintRuns'

// Life 10's fingerprints, split over three files so they run in parallel; see `fingerprintRuns.ts`.
checkFingerprints(['noPractice', 'talent'])
