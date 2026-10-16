import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { PublicVerificationRoute } from './PublicVerificationRoute'
import { captureEmailCorrectionEntry, clearVerificationToken } from '../../lib/email-correction-entry'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); clearVerificationToken(); history.replaceState(null, '', '/') })
it('initial GET is inert and explicit verification uses no login, bearer, cookies or CSRF bootstrap', async () => {
  history.replaceState(null, '', '/data-requests/verify-email#token=memory-token')
  captureEmailCorrectionEntry()
  const calls: Array<[string, RequestInit | undefined]> = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => { calls.push([String(input), init]); return new Response(JSON.stringify(String(input).endsWith('/oauth-providers') ? { dataRequests: { emailCorrection: { enabled: true } } } : { status: 'verified', serverTime: '2026-10-16T00:00:00Z' }), { status: 200, headers: { 'Content-Type': 'application/json' } }) })
  render(<PublicVerificationRoute />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm verification' })).not.toBeDisabled())
  expect(calls).toHaveLength(1)
  expect(calls[0][0]).toBe('/api/account/v1/oauth-providers')
  expect(calls[0][1]).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error' })
  await userEvent.click(screen.getByRole('button', { name: 'Confirm verification' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument())
  expect(calls).toHaveLength(2)
  expect(calls[1][0]).toBe('/api/account/v1/data-requests/email-verification')
  expect(calls[1][1]).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', body: '{"token":"memory-token"}' })
  expect(new Headers(calls[1][1]?.headers).has('Authorization')).toBe(false)
  expect(new Headers(calls[1][1]?.headers).has('X-CSRF-Token')).toBe(false)
})
it('refresh without the fragment offers reopening the email, with no verification action', () => {
  history.replaceState(null, '', '/data-requests/verify-email'); captureEmailCorrectionEntry(); render(<PublicVerificationRoute />)
  expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent(/email/i)
})
it('disables public verification when discovery says OFF without consuming the token', async () => {
  history.replaceState(null, '', '/data-requests/verify-email#token=memory-token'); captureEmailCorrectionEntry()
  const calls: string[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => { calls.push(String(input)); return new Response(JSON.stringify({ dataRequests: { emailCorrection: { enabled: false } } }), { status: 200 }) })
  render(<PublicVerificationRoute />)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument())
  expect(calls).toEqual(['/api/account/v1/oauth-providers'])
})
it('keeps verification disabled after discovery failure and retries only the safe GET', async () => {
  history.replaceState(null, '', '/data-requests/verify-email#token=memory-token'); captureEmailCorrectionEntry()
  let fail = true; const calls: string[] = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => { calls.push(String(input)); return new Response(JSON.stringify(fail ? { status: 'error', errorCode: 'ACC_SERVICE_UNAVAILABLE' } : { dataRequests: { emailCorrection: { enabled: true } } }), { status: fail ? 503 : 200 }) })
  render(<PublicVerificationRoute />)
  await screen.findByRole('button', { name: 'Retry' })
  expect(screen.getByRole('button', { name: 'Confirm verification' })).toBeDisabled()
  fail = false; await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm verification' })).not.toBeDisabled())
  expect(calls).toEqual(['/api/account/v1/oauth-providers', '/api/account/v1/oauth-providers'])
})

it.each(['discovery', 'verification'])('exposes Retry-After and disables the %s action until available', async stage => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T00:00:00Z'))
  history.replaceState(null, '', '/data-requests/verify-email#token=memory-token'); captureEmailCorrectionEntry()
  let requests = 0
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    requests++
    const limited = stage === 'discovery' || !String(input).endsWith('/oauth-providers')
    return new Response(JSON.stringify(limited ? { errorCode: 'ACC_AUTH_RATE_LIMITED' } : { dataRequests: { emailCorrection: { enabled: true } } }), { status: limited ? 429 : 200, headers: { 'Retry-After': '45' } })
  })
  await act(async () => { render(<PublicVerificationRoute />) })
  if (stage === 'verification') await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm verification' })) })
  const label = stage === 'discovery' ? 'Retry' : 'Confirm verification'
  expect(screen.getByText(/^Try again after /)).toBeVisible()
  expect(screen.getByRole('button', { name: label })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(requests).toBe(stage === 'discovery' ? 1 : 2)
  await act(() => vi.advanceTimersByTimeAsync(45000))
  expect(screen.getByRole('button', { name: label })).not.toBeDisabled()
})
