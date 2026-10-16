import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmailCorrectionVerification } from './EmailCorrectionVerification'

describe('public email correction verification presentation', () => {
  it('requires an explicit confirmation and does not expose account information', async () => {
    const verify = vi.fn()
    render(<EmailCorrectionVerification locale="en" view="ready" onVerify={verify} onReturn={() => {}} />)
    expect(verify).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm verification' }))
    expect(verify).toHaveBeenCalledOnce()
  })
  it('explains missing fragment after refresh', () => {
    render(<EmailCorrectionVerification locale="en" view="missing_token" onVerify={() => {}} onReturn={() => {}} />)
    expect(screen.getByText('Reopen the verification link in your email.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument()
  })
  it('uses the safe success state for an already verified token', () => {
    render(<EmailCorrectionVerification locale="en" view="already_verified" onVerify={() => {}} onReturn={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Please wait for administrator approval')
    expect(screen.queryByRole('button', { name: 'Confirm verification' })).not.toBeInTheDocument()
  })
})
