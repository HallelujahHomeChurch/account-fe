import { captureEmailCorrectionEntry } from './lib/email-correction-entry'
import { shouldOfferLineHandoff } from './lib/line-browser-handoff'

// Capture before importing auth, router tracing, analytics, or any application entry.
if (captureEmailCorrectionEntry()) void import('./email-correction-public-entry')
else if (shouldOfferLineHandoff()) void import('./line-browser-entry')
else void import('./account-entry')
