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

it('renders reviewer-unavailable catalog as no-reviewer through the installed official SDK', async () => {
  const redirect = vi.fn()
  const paths: string[] = []
  const api = new AccountApi({ baseUrl: '/api/account/v1', fetcher: async url => {
    const path = String(url)
    paths.push(path)
    if (path.endsWith('/oauth-providers')) return Response.json({ dataRequests: { emailCorrection: { enabled: true } } })
    if (path.endsWith('/requests/current')) return Response.json({ request: null, serverTime: now })
    if (path.endsWith('/data-requests/items')) return Response.json({
      currentEmail: 'old@example.test', serverTime: now,
      items: [{ kind: 'email_change', fields: correctionCatalog[0].fields }],
      eligibility: { status: 'ineligible', errorCode: 'ACC_CORRECTION_REVIEWER_UNAVAILABLE' }, allowedActions: [],
    })
    throw new Error(`Unexpected request: ${path}`)
  } })
  const controller = new CorrectionController(api.dataRequests, { eligible: true, currentEmail: 'old@example.test' }, redirect)
  try {
    await controller.load()
    render(<DataRequestsPage {...controller.getSnapshot()} locale="en" onEmailChange={() => {}} onAction={() => {}} />)
    expect(paths.sort()).toEqual(['/api/account/v1/data-requests/items', '/api/account/v1/data-requests/requests/current', '/api/account/v1/oauth-providers'])
    expect(screen.getByText(emailCorrectionMessages.en.noReviewer)).toBeVisible()
    expect(controller.getSnapshot()).toMatchObject({ view: 'no_reviewer', eligible: false, error: undefined })
    expect(screen.queryByText(emailCorrectionMessages.en.loadError)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: emailCorrectionMessages.en.next })).not.toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  } finally { controller.dispose() }
})
