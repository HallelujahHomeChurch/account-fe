import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { AccountHeaderSearch } from './AccountHeaderSearch'

const items = [{ id: 'mfa', label: 'Authenticator app', category: 'Security', keywords: ['MFA'], to: '/security#mfa' }]
function Search() {
  const [value, onChange] = useState('')
  return <AccountHeaderSearch value={value} onChange={onChange} items={items} />
}
it('shows only matching function destinations after submit and closes on selection', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><Search /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: 'Search account settings' }))
  await user.type(screen.getByRole('searchbox'), 'mfa{Enter}')
  const result = await screen.findByRole('link', { name: /Authenticator app/ })
  expect(result).toHaveAttribute('href', '/security#mfa')
  await user.click(result)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
