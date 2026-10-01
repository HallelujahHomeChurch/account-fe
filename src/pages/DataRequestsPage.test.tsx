import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError, type DSRRequest } from '../lib/api'
import { DataRequestsPage } from './DataRequestsPage'

const profile = { id: 'u1', email: 'ray@example.com' }
const baseRequest: DSRRequest = {
  id: 'request-1', request_type: 'access_export', status: 'processing',
  identity_verified_at: '2026-09-03T00:00:00Z', submitted_at: '2026-09-03T00:00:00Z', version: 1,
  executions: [
    { owner: 'account', action: 'export', status: 'succeeded', attempt_count: 1, result_summary: {} },
    { owner: 'engagement', action: 'export', status: 'running', attempt_count: 1, result_summary: {} },
  ],
}

function renderPage(overrides: Partial<AuthApi> = {}) {
  const api: AuthApi = {
    login: async () => ({ access_token: 'token' }), refreshAccessToken: async () => 'token',
    me: async () => profile, logout: async () => ({}), listDSRRequests: async () => [], ...overrides,
  }
  return render(
    <MemoryRouter initialEntries={['/data-requests']}>
      <LocaleProvider><AuthProvider api={api}><Routes>
        <Route path="/data-requests" element={<><DataRequestsPage /><Location /></>} />
        <Route path="/profile" element={<><h1>Personal info</h1><Location /></>} />
        <Route path="/login" element={<Location />} />
      </Routes></AuthProvider></LocaleProvider>
    </MemoryRouter>,
  )
}

function Location() { return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output> }

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('DataRequestsPage', () => {
  it('creates one request type and renders owner progress', async () => {
    const createDSRRequest = vi.fn(async () => baseRequest)
    renderPage({ createDSRRequest })
    await userEvent.click(await screen.findByRole('button', { name: 'Request data export' }))
    expect(createDSRRequest).toHaveBeenCalledWith('access_export')
    expect(await screen.findByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Engagement')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('presents all four data-request operations as action cards', async () => {
    renderPage()
    const operations = await screen.findByRole('region', { name: 'Create a request' })
    expect(within(operations).getAllByRole('article')).toHaveLength(4)
    expect(within(operations).getByRole('button', { name: 'Request data export' })).toBeInTheDocument()
    expect(within(operations).getByRole('button', { name: 'Restrict data processing' })).toBeInTheDocument()
    expect(within(operations).getByRole('button', { name: 'Start account erasure' })).toBeInTheDocument()
    expect(within(operations).queryByRole('button', { name: 'Update personal info' })).not.toBeInTheDocument()
  })

  it('requires exact email and confirmation for erasure', async () => {
    const erasure = { ...baseRequest, request_type: 'erasure' as const, status: 'submitted' as const }
    const createDSRRequest = vi.fn(async () => erasure)
    const confirmDSRErasure = vi.fn(async () => ({ ...erasure, status: 'in_review' as const, version: 2 }))
    renderPage({ createDSRRequest, confirmDSRErasure })
    await userEvent.click(await screen.findByRole('button', { name: 'Start account erasure' }))
    await userEvent.type(screen.getByLabelText('Current email'), 'RAY@example.com')
    expect(screen.getByRole('button', { name: 'Confirm account erasure' })).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Current email'))
    await userEvent.type(screen.getByLabelText('Current email'), '  ray@example.com  ')
    await userEvent.click(screen.getByLabelText('I understand this action removes account data'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm account erasure' }))
    expect(confirmDSRErasure).toHaveBeenCalledWith('request-1', 1, 'ray@example.com')
  })

  it('redirects stale authentication to normal login with return path', async () => {
    renderPage({ createDSRRequest: async () => { throw new ApiError(401, 'reauth', 'ACC_DSR_REAUTH_REQUIRED') } })
    await userEvent.click(await screen.findByRole('button', { name: 'Request data export' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login?return_to=%2Fdata-requests'))
  })

  it('resumes a submitted erasure confirmation after returning from sign-in', async () => {
    const erasure = { ...baseRequest, request_type: 'erasure' as const, status: 'submitted' as const }
    renderPage({ listDSRRequests: async () => [erasure] })
    expect(await screen.findByRole('heading', { name: 'Confirm account erasure' })).toBeInTheDocument()
  })

  it('removes stale erasure confirmation after cancellation', async () => {
    const erasure = { ...baseRequest, request_type: 'erasure' as const, status: 'submitted' as const }
    const cancelDSRRequest = vi.fn(async () => ({ ...erasure, status: 'cancelled' as const, version: 2 }))
    const confirmDSRErasure = vi.fn()
    renderPage({ listDSRRequests: async () => [erasure], cancelDSRRequest, confirmDSRErasure })

    expect(await screen.findByRole('heading', { name: 'Confirm account erasure' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(screen.queryByRole('heading', { name: 'Confirm account erasure' })).not.toBeInTheDocument()
    expect(confirmDSRErasure).not.toHaveBeenCalled()
  })

  it('starts a replacement erasure with blank confirmation state', async () => {
    const erasureA = { ...baseRequest, id: 'erasure-a', request_type: 'erasure' as const, status: 'submitted' as const }
    const erasureB = { ...erasureA, id: 'erasure-b' }
    const createDSRRequest = vi.fn(async () => erasureB)
    const cancelDSRRequest = vi.fn(async () => ({ ...erasureA, status: 'cancelled' as const, version: 2 }))
    const confirmDSRErasure = vi.fn()
    renderPage({ listDSRRequests: async () => [erasureA], createDSRRequest, cancelDSRRequest, confirmDSRErasure })

    await userEvent.type(await screen.findByLabelText('Current email'), 'ray@example.com')
    await userEvent.click(screen.getByLabelText('I understand this action removes account data'))
    expect(screen.getByRole('button', { name: 'Confirm account erasure' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start account erasure' }))

    expect(screen.getByLabelText('Current email')).toHaveValue('')
    expect(screen.getByLabelText('I understand this action removes account data')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Confirm account erasure' })).toBeDisabled()
    expect(confirmDSRErasure).not.toHaveBeenCalled()
  })

  it('downloads and revokes the temporary object URL', async () => {
    const completed = { ...baseRequest, status: 'completed' as const, export_expires_at: '2099-01-01T00:00:00Z' }
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderPage({
      listDSRRequests: async () => [completed],
      issueDSRDownload: async () => ({ download_url: '/api/account/v1/dsr/downloads/token' }),
      redeemDSRDownload: async () => new Blob(['zip'], { type: 'application/zip' }),
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Download data export' }))
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:export'))
    expect(createObjectURL).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
  })

  it('revokes a temporary download URL when the browser click fails', async () => {
    const completed = { ...baseRequest, status: 'completed' as const, export_expires_at: '2099-01-01T00:00:00Z' }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-export')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('blocked') })
    renderPage({ listDSRRequests: async () => [completed], issueDSRDownload: async () => ({ download_url: '/api/account/v1/dsr/downloads/token' }), redeemDSRDownload: async () => new Blob(['zip']) })

    await userEvent.click(await screen.findByRole('button', { name: 'Download data export' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to complete the data request.')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed-export')
  })
})

it('requires correction scope, current value and requested value before submission', async () => {
  const createDSRRequest = vi.fn(async () => ({ ...baseRequest, request_type: 'correction' as const }))
  renderPage({ createDSRRequest })
  await userEvent.click(await screen.findByRole('button', { name: 'Request data correction' }))
  const submit = screen.getByRole('button', { name: 'Submit correction' })
  expect(submit).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Data or location to correct'), '  Profile name  ')
  await userEvent.type(screen.getByLabelText('Current value'), 'Old name')
  expect(submit).toBeDisabled()
  await userEvent.type(screen.getByLabelText('Requested value'), 'New name')
  await userEvent.click(submit)
  expect(createDSRRequest).toHaveBeenCalledWith('correction', { description: 'Profile name', current_value: 'Old name', requested_value: 'New name' })
})

it('includes optional scope in a new export request', async () => {
  const createDSRRequest = vi.fn(async () => baseRequest)
  renderPage({ createDSRRequest })
  await userEvent.type(await screen.findByLabelText('Request scope (optional)'), '  2026 reservations  ')
  await userEvent.click(screen.getByRole('button', { name: 'Request data export' }))
  expect(createDSRRequest).toHaveBeenCalledWith('access_export', { description: '2026 reservations' })
})

it('shows requested information and submits a version-bound supplement', async () => {
  const request = { ...baseRequest, information_requested: 'Please identify the affected record.', description: 'Existing scope', version: 4 }
  const supplementDSRRequest = vi.fn(async () => ({ ...request, information_requested: '', version: 5 }))
  renderPage({ listDSRRequests: async () => [request], supplementDSRRequest })
  expect(await screen.findByText('Please identify the affected record.')).toBeInTheDocument()
  await userEvent.clear(screen.getByRole('textbox', { name: 'Additional information' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'Additional information' }), 'Record A from September')
  await userEvent.click(screen.getByRole('button', { name: 'Send additional information' }))
  expect(supplementDSRRequest).toHaveBeenCalledWith('request-1', { version: 4, description: 'Record A from September', current_value: '', requested_value: '' })
  expect(screen.queryByRole('button', { name: 'Send additional information' })).not.toBeInTheDocument()
})

it('shows all owner progress and only public reviewer replies', async () => {
  renderPage({ listDSRRequests: async () => [{ ...baseRequest, executions: [
    { owner: 'operations', action: 'export', status: 'succeeded', attempt_count: 1, result_summary: { public_response: 'Reservations included.', internal_note: 'DO NOT DISCLOSE' } },
    { owner: 'website_watermark', action: 'export', status: 'not_applicable', attempt_count: 1, result_summary: {} },
  ] } as DSRRequest] })
  expect(await screen.findByText('Reservations and groups')).toBeInTheDocument()
  expect(screen.getByText('Website access records')).toBeInTheDocument()
  expect(screen.getByText('Reservations included.')).toBeInTheDocument()
  expect(screen.queryByText('DO NOT DISCLOSE')).not.toBeInTheDocument()
})

it('disables expired downloads and offers a new export with the original scope', async () => {
  const issueDSRDownload = vi.fn()
  const createDSRRequest = vi.fn(async () => baseRequest)
  renderPage({ listDSRRequests: async () => [{ ...baseRequest, status: 'completed', export_expires_at: '2020-01-01T00:00:00Z', description: 'Reservations' }], issueDSRDownload, createDSRRequest })
  expect(await screen.findByRole('button', { name: 'Download data export' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Request a new export' }))
  expect(issueDSRDownload).not.toHaveBeenCalled()
  expect(createDSRRequest).toHaveBeenCalledWith('access_export', { description: 'Reservations' })
})

it('polls active requests without overlap and pauses while hidden and after unmount', async () => {
  vi.useFakeTimers()
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  let resolvePoll: (requests: DSRRequest[]) => void = () => undefined
  const listDSRRequests = vi.fn().mockResolvedValueOnce([baseRequest]).mockImplementationOnce(() => new Promise<DSRRequest[]>((resolve) => { resolvePoll = resolve })).mockResolvedValue([{ ...baseRequest, status: 'completed' }])
  const view = renderPage({ listDSRRequests })
  await act(async () => {})
  expect(listDSRRequests).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(2)
  visibility.mockReturnValue('hidden')
  fireEvent(document, new Event('visibilitychange'))
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(2)
  visibility.mockReturnValue('visible')
  fireEvent(document, new Event('visibilitychange'))
  await act(async () => {})
  expect(listDSRRequests).toHaveBeenCalledTimes(2)
  await act(async () => { resolvePoll([baseRequest]) })
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(3)
  await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(3)
  view.unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(3)
})

it('expires a completed export without polling completed requests', async () => {
  vi.useFakeTimers()
  const listDSRRequests = vi.fn().mockResolvedValue([{ ...baseRequest, status: 'completed', export_expires_at: new Date(Date.now() + 1000).toISOString() }])
  renderPage({ listDSRRequests })
  await act(async () => {})
  expect(screen.getByRole('button', { name: 'Download data export' })).toBeEnabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(1001) })
  expect(screen.getByRole('button', { name: 'Download data export' })).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(listDSRRequests).toHaveBeenCalledTimes(1)
})

it('keeps the draft base version until a conflicting update is explicitly refreshed', async () => {
  vi.useFakeTimers()
  const request = { ...baseRequest, information_requested: 'Please identify the record.', description: 'Original scope', version: 4 }
  const listDSRRequests = vi.fn().mockResolvedValueOnce([request]).mockResolvedValue([{ ...request, version: 5 }])
  const supplementDSRRequest = vi.fn().mockRejectedValueOnce(new ApiError(409, 'conflict', 'ACC_DSR_CONFLICT')).mockResolvedValueOnce({ ...request, information_requested: '', version: 6 })
  renderPage({ listDSRRequests, supplementDSRRequest })
  await act(async () => {})
  fireEvent.change(screen.getByRole('textbox', { name: 'Additional information' }), { target: { value: 'My unsent details' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(screen.getByRole('textbox', { name: 'Additional information' })).toHaveValue('My unsent details')
  fireEvent.submit(screen.getByRole('textbox', { name: 'Additional information' }).closest('form')!)
  await act(async () => {})
  expect(supplementDSRRequest).toHaveBeenCalledWith('request-1', { version: 4, description: 'My unsent details', current_value: '', requested_value: '' })
  const field = screen.getByRole('textbox', { name: 'Additional information' })
  expect(field).toHaveValue('My unsent details')
  const form = field.closest('form')!
  fireEvent.click(within(form).getByRole('button', { name: 'Refresh' }))
  fireEvent.submit(form)
  await act(async () => {})
  expect(supplementDSRRequest).toHaveBeenLastCalledWith('request-1', { version: 5, description: 'My unsent details', current_value: '', requested_value: '' })
})

 it('keeps cleaned-up exports unavailable and offers a replacement', async () => {
  const issueDSRDownload = vi.fn()
  renderPage({ listDSRRequests: async () => [{ ...baseRequest, status: 'completed' }], issueDSRDownload })
  expect(await screen.findByRole('button', { name: 'Download data export' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Request a new export' })).toBeInTheDocument()
  expect(issueDSRDownload).not.toHaveBeenCalled()
})

it('requires explicit restriction targets and impact confirmation before submitting', async () => {
  const createDSRRequest = vi.fn(async () => ({ ...baseRequest, request_type: 'restrict_processing' as const }))
  renderPage({ createDSRRequest })
  await userEvent.click(await screen.findByRole('button', { name: 'Restrict data processing' }))
  expect(createDSRRequest).not.toHaveBeenCalled()
  const submit = screen.getByRole('button', { name: 'Confirm selected restrictions' })
  expect(submit).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Newsletter subscriptions: stop newsletter emails; Web Push stays active.' }))
  expect(submit).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox', { name: 'I understand the effects of the selected restrictions.' }))
  await userEvent.click(submit)
  expect(createDSRRequest).toHaveBeenCalledWith('restrict_processing', { scope_targets: ['subscriptions'], scope_confirmed: true })
})

it('requires scope reconfirmation after a legacy case version changes', async () => {
 vi.useFakeTimers()
 const legacy: DSRRequest = { ...baseRequest, request_type:'restrict_processing', plan_version:0, information_requested:'Confirm purposes', executions:[{owner:'engagement',action:'restrict_processing',status:'pending',attempt_count:0,result_summary:{}}] }
 const listDSRRequests=vi.fn().mockResolvedValueOnce([legacy]).mockResolvedValue([{...legacy,version:2}])
 const supplementDSRRequest=vi.fn(async()=>({...legacy,version:3,plan_version:1}))
 renderPage({listDSRRequests,supplementDSRRequest})
 await act(async()=>{})
 const form=screen.getByRole('button',{name:'Confirm selected restrictions'}).closest('form')!
 fireEvent.click(within(form).getByRole('checkbox',{name:'Newsletter subscriptions: stop newsletter emails; Web Push stays active.'}))
 fireEvent.click(within(form).getByRole('checkbox',{name:'I understand the effects of the selected restrictions.'}))
 await act(async()=>{await vi.advanceTimersByTimeAsync(30_000)})
 expect(within(form).getByRole('button',{name:'Confirm selected restrictions'})).toBeDisabled()
 fireEvent.click(within(form).getByRole('button',{name:'Refresh'}))
 expect(within(form).getByRole('checkbox',{name:'Newsletter subscriptions: stop newsletter emails; Web Push stays active.'})).not.toBeChecked()
 expect(within(form).getByRole('checkbox',{name:'I understand the effects of the selected restrictions.'})).not.toBeChecked()
 fireEvent.click(within(form).getByRole('checkbox',{name:'Newsletter subscriptions: stop newsletter emails; Web Push stays active.'}))
 fireEvent.click(within(form).getByRole('checkbox',{name:'I understand the effects of the selected restrictions.'}))
 fireEvent.click(within(form).getByRole('button',{name:'Confirm selected restrictions'}))
 await act(async()=>{})
 expect(supplementDSRRequest).toHaveBeenCalledWith('request-1',expect.objectContaining({version:2,scope_targets:['subscriptions'],scope_confirmed:true}))
})

it('keeps legacy receipt and deadlines pending review even when processing has started',async()=>{
 renderPage({listDSRRequests:async()=>[{...baseRequest,started_at:'2026-09-03T00:01:00Z'}]})
 expect(await screen.findByText('Decision deadline needs verification')).toBeInTheDocument()
 expect(screen.queryByText('Decision recorded at')).not.toBeInTheDocument()
})

it('renders the recorded public refusal as text without inventing a legacy reason', async () => {
 renderPage({ listDSRRequests: async () => [{ ...baseRequest, status: 'rejected', decision_public_response: '<script>Specific public reason</script> Contact support for the next step.' }, { ...baseRequest, id: 'legacy-refusal', status: 'rejected' }] })
 expect(await screen.findByText('<script>Specific public reason</script> Contact support for the next step.')).toBeInTheDocument()
 expect(document.querySelector('script')).toBeNull()
 expect(screen.getByText(/public reason for this legacy refusal needs verification/)).toHaveTextContent('support@alive.org.tw')
})

it('renders multiple public information rounds as escaped read-only history', async () => {
 renderPage({listDSRRequests: async () => [{...baseRequest, public_history_has_more: true, public_history: [
 {action:'information_requested',case_version:2,created_at:'2026-09-03T00:00:00Z',public_message:'<script>question one</script>'},
 {action:'information_supplied',case_version:3,created_at:'2026-09-03T01:00:00Z',public_supplement:{description:'reply one',current_value:'old value',requested_value:'new value'}}
 ]}]})
 expect(await screen.findByText('<script>question one</script>')).toBeInTheDocument()
 expect(screen.getByText('reply one')).toBeInTheDocument()
 expect(screen.getByText(/Showing the latest 20 conversation entries/)).toBeInTheDocument()
 expect(document.querySelector('.dsr-public-history script')).toBeNull()
})

it('loads older public rounds without losing current entries on failed retry', async () => {
 const older={action:'information_requested',case_version:1,created_at:'2026-09-01T00:00:00Z',public_message:'older question'}
 const listDSRPublicHistory=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({events:[older],case_version:1})
 renderPage({listDSRRequests:async()=>[{...baseRequest,public_history_has_more:true,public_history_next_cursor:'cursor-one',public_history:[{...older,case_version:2,public_message:'latest question'}]}],listDSRPublicHistory})
 await screen.findByText('latest question')
 await userEvent.click(screen.getByRole('button',{name:'Load earlier entries'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not load earlier entries')
 expect(screen.getByText('latest question')).toBeInTheDocument()
 await userEvent.click(screen.getByRole('button',{name:'Load earlier entries'}))
 expect(await screen.findByText('older question')).toBeInTheDocument()
 expect(screen.getByText('latest question')).toBeInTheDocument()
 expect(listDSRPublicHistory).toHaveBeenNthCalledWith(2,'request-1',1,'cursor-one')
 expect(screen.queryByRole('button',{name:'Load earlier entries'})).not.toBeInTheDocument()
})

it('preserves loaded history on version conflict and refreshes before continuing', async () => {
 const event={action:'information_requested',case_version:2,created_at:'2026-09-03T00:00:00Z',public_message:'previous question'}
 const listDSRRequests=vi.fn().mockResolvedValueOnce([{...baseRequest,public_history_has_more:true,public_history_next_cursor:'old-cursor',public_history:[event]}]).mockResolvedValueOnce([{...baseRequest,version:2,public_history:[{...event,public_message:'fresh question'}]}])
 const listDSRPublicHistory=vi.fn().mockRejectedValue(new ApiError(409,'changed','ACC_DSR_CONFLICT'))
 renderPage({listDSRRequests,listDSRPublicHistory})
 await screen.findByText('previous question')
 await userEvent.click(screen.getByRole('button',{name:'Load earlier entries'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('changed')
 expect(screen.getByText('previous question')).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Load earlier entries'})).not.toBeInTheDocument()
 await userEvent.click(within(document.querySelector('.dsr-public-history')!).getByRole('button',{name:'Refresh'}))
 expect(await screen.findByText('fresh question')).toBeInTheDocument()
 expect(screen.queryByText('previous question')).not.toBeInTheDocument()
 expect(listDSRPublicHistory).toHaveBeenCalledTimes(1)
})

it('separates a queued withdrawal from the completed original restriction',async()=>{
 const request:DSRRequest={...baseRequest,request_type:'restrict_processing',status:'completed',plan_version:1,scope_targets:['membership'],executions:[{owner:'operations',action:'withdraw_restriction',status:'pending',attempt_count:0,result_summary:{}},{owner:'operations',action:'restrict_processing',status:'succeeded',attempt_count:1,result_summary:{}}]}
 renderPage({listDSRRequests:async()=>[request]})
 expect(await screen.findByRole('heading',{name:'Restriction withdrawal'})).toBeInTheDocument()
 expect(screen.getByText('The original restriction remains recorded. Withdrawal does not restore membership, roles, subscriptions or deleted data.')).toBeInTheDocument()
})

it('does not infer a cleared fence from an unknown withdrawal receipt',async()=>{
 const request:DSRRequest={...baseRequest,status:'completed',executions:[{owner:'operations',action:'withdraw_restriction',status:'succeeded',attempt_count:1,result_summary:{reason_codes:['DSR_UNKNOWN']}}]}
 renderPage({listDSRRequests:async()=>[request]})
 await screen.findByRole('heading',{name:'Restriction withdrawal'})
 expect(screen.queryByText('This request’s restriction was withdrawn; no other verified restriction remained at execution.')).not.toBeInTheDocument()
})
