import { captureEmailCorrectionEntry } from './lib/email-correction-entry'

// Capture before importing auth, router tracing, analytics, or any application entry.
if (captureEmailCorrectionEntry()) void import('./email-correction-public-entry')
else void import('./account-entry')
