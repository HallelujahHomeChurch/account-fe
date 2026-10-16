import { act, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataRequestsPage, type DataRequestsPageProps } from './DataRequestsPage'
import { correctionCatalog } from '../features/email-correction/catalog'
import { emailCorrectionMessages } from '../features/email-correction/messages'

const props: DataRequestsPageProps = { locale: 'en', view: 'form', currentEmail: 'old@example.test', newEmail: 'new@example.test', onEmailChange: () => {}, onAction: () => {} }
describe('Email correction presentation', () => {
  it('renders fields from catalog and keeps the current email selectable and readonly', () => {
    render(<DataRequestsPage {...props} />)
    for (const field of correctionCatalog[0].fields) expect(screen.getByLabelText(emailCorrectionMessages.en[field.labelKey])).toHaveValue(props[field.key])
    const current = screen.getByLabelText('Current email')
    expect(current).toHaveAttribute('readonly')
    expect(current).not.toBeDisabled()
    expect(screen.getByLabelText('New email')).toHaveAttribute('aria-describedby', expect.stringContaining('correction-consequence'))
  })
  it('validates identical email after mouse release without shifting the submit target on blur', async () => {
    const user = userEvent.setup()
    const action = vi.fn()
    function EditablePage() {
      const [email, setEmail] = useState('')
      return <DataRequestsPage {...props} newEmail={email} onEmailChange={setEmail} onAction={action} />
    }
    render(<EditablePage />)
    await user.type(screen.getByLabelText('New email'), 'OLD@example.test')
    const next = screen.getByRole('button', { name: 'Next: verify your identity' })
    await user.pointer({ target: next, keys: '[MouseLeft>]' })
    expect(screen.queryByText('Enter an email different from your current email.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('New email')).not.toHaveAttribute('aria-invalid', 'true')
    await user.pointer({ target: next, keys: '[/MouseLeft]' })
    expect(action).not.toHaveBeenCalled()
    expect(screen.getByText('Enter an email different from your current email.')).toBeVisible()
    await waitFor(() => expect(screen.getByLabelText('New email')).toHaveFocus())
  })
  it.each([{ eligible: false }, { enabled: false }])('does not allow an ineligible or disabled submission %j', blocked => {
    render(<DataRequestsPage {...props} {...blocked} />)
    expect(screen.getByRole('button', { name: 'Next: verify your identity' })).toBeDisabled()
  })
  it('shows only available verification methods and retains the email after failure', () => {
    render(<DataRequestsPage {...props} view="reauth" passwordAvailable={false} providers={['LINE']} error="reauth" />)
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify with LINE and continue' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Google/ })).not.toBeInTheDocument()
    expect(screen.getByText('new@example.test')).toBeVisible()
  })
  it('keeps the known application on 503 and feature-off permits cancellation only', async () => {
    const action = vi.fn()
    render(<DataRequestsPage {...props} view="pending_verification" error="unavailable" enabled={false} onAction={action} />)
    expect(screen.getByText('new@example.test')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Resend|replacement|Sign in/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    expect(screen.getByRole('dialog')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Keep request' }))
    expect(action).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel request' })).toHaveFocus()
  })
  it('does not claim completion on 401', () => {
    render(<DataRequestsPage {...props} view="unauthorized" />)
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeVisible()
    expect(screen.queryByText('Email changed')).not.toBeInTheDocument()
  })
  it('opens a subsequent draft from completion without submitting it', async () => {
    const action = vi.fn()
    render(<DataRequestsPage {...props} view="completed" onAction={action} />)
    expect(screen.getByRole('button', { name: 'Back to profile' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Start a new request' }))
    expect(action.mock.calls).toEqual([['new']])
  })
  it.each([{ enabled: false }, { eligible: false }])('hides the subsequent-request action when %j', blocked => {
    render(<DataRequestsPage {...props} view="completed" {...blocked} />)
    expect(screen.queryByRole('button', { name: 'Start a new request' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to profile' })).toBeVisible()
  })
  it.each(Object.keys(emailCorrectionMessages) as Array<keyof typeof emailCorrectionMessages>)('renders the catalog in %s', locale => {
    render(<DataRequestsPage {...props} locale={locale} />)
    expect(screen.getByLabelText(emailCorrectionMessages[locale].newEmail)).toBeVisible()
  })
})
it('renders the server catalog field order and maps its known field labels without inventing a form branch',()=>{
 const fields=correctionCatalog[0].fields.map(field=>({...field,labelKey:`dataRequests.${field.key}`})).reverse()
 render(<DataRequestsPage {...props} catalog={{items:[{kind:'email_change',fields:fields as [typeof fields[number],typeof fields[number]]}],currentEmail:props.currentEmail,serverTime:'2026-10-16T00:00:00Z',eligibility:{status:'eligible'},allowedActions:['reauth']}}/>)
 expect(screen.getAllByRole('textbox').map(input=>input.getAttribute('name'))).toEqual(['newEmail','currentEmail'])
 expect(screen.getByLabelText('Current email')).toHaveAttribute('readonly')
})

it.each(['reauth', 'mfa'] as const)('clears the submitted %s secret on factor rejection while retaining the email', async view => {
  const action = vi.fn()
  function RejectedFactor() {
    const [failed, setFailed] = useState(false)
    return <DataRequestsPage {...props} view={view} error={failed ? 'reauth' : undefined} onAction={(...args) => { action(...args); setFailed(true) }} />
  }
  const { container } = render(<RejectedFactor />)
  const secret = container.querySelector<HTMLInputElement>(view === 'mfa' ? 'input[name="code"]' : 'input[name="password"]')!
  const value = view === 'mfa' ? '123456' : 'wrong-secret'
  await userEvent.type(secret, value)
  await userEvent.click(screen.getByRole('button', { name: 'Verify and submit' }))
  expect(action).toHaveBeenCalledWith(view === 'mfa' ? 'mfa' : 'password', value)
  expect(container.querySelector(view === 'mfa' ? 'input[name="code"]' : 'input[name="password"]')).toHaveValue('')
  expect(screen.getByText('new@example.test')).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent(emailCorrectionMessages.en.reauthFailed)
})

afterEach(() => vi.useRealTimers())
it('shows the server retry time and disables retry until that deadline', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T00:00:00Z'))
  render(<DataRequestsPage {...props} view="pending_verification" error="unavailable" retryAt={Date.now() + 45000} />)
  expect(screen.getByText(/^Try again after /)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()
  await act(() => vi.advanceTimersByTimeAsync(44999))
  expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(screen.getByRole('button', { name: 'Retry' })).not.toBeDisabled()
  expect(screen.queryByText(/^Try again after /)).not.toBeInTheDocument()
})
