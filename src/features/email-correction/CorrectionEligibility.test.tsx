import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AccountApi } from '../../lib/api'
import { DataRequestsPage } from '../../pages/DataRequestsPage'
import { correctionCatalog } from './catalog'
import { emailCorrectionMessages } from './messages'
import { CorrectionController } from './controller'

const now = '2026-10-16T00:00:00Z'
const eligibilityCases = [
  { eligibility: { status: 'eligible' }, view: 'form', text: 'Next: verify your identity' },
  { eligibility: { status: 'ineligible', errorCode: 'ACC_CORRECTION_EMAIL_UNVERIFIED' }, view: 'unverified', text: 'Verify your current email first.' },
  { eligibility: { status: 'ineligible', errorCode: 'ACC_CORRECTION_INELIGIBLE' }, view: 'ineligible', text: 'This account currently cannot complete identity verification for an email change. Try again later.' },
  { eligibility: { status: 'ineligible', errorCode: 'ACC_CORRECTION_DISABLED' }, view: 'loading', text: '' },
]
it.each(eligibilityCases)('renders the actual catalog $eligibility through AccountApi as $view', async ({ eligibility, view, text }) => {
  const redirect = vi.fn()
  const api = new AccountApi({ baseUrl: '/api/account/v1', fetcher: async url => {
    const data = String(url).endsWith('/oauth-providers') ? { dataRequests: { emailCorrection: { enabled: true } } }
      : String(url).endsWith('/requests/current') ? { request: null, serverTime: now }
      : { currentEmail: 'old@example.test', serverTime: now, items: eligibility.errorCode === 'ACC_CORRECTION_DISABLED' ? [] : [{ kind: 'email_change', fields: correctionCatalog[0].fields }], eligibility, allowedActions: eligibility.status === 'eligible' ? ['reauth'] : [] }
    return Response.json(data)
  } })
  const controller = new CorrectionController(api.dataRequests, { eligible: true, currentEmail: 'old@example.test' }, redirect)
  try {
    await controller.load()
    expect(controller.getSnapshot().view).toBe(view)
    render(<DataRequestsPage {...controller.getSnapshot()} locale="en" onEmailChange={() => {}} onAction={() => {}} />)
    if (text) expect(screen.getByText(text)).toBeVisible()
    expect(screen.queryByText(emailCorrectionMessages.en.noReviewer)).not.toBeInTheDocument()
    if (eligibility.errorCode === 'ACC_CORRECTION_DISABLED') {
      expect(controller.getSnapshot().enabled).toBe(false)
      expect(redirect).toHaveBeenCalledWith('/profile')
    } else expect(redirect).not.toHaveBeenCalled()
  } finally { controller.dispose() }
})
