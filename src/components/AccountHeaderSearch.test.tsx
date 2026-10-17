import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { expect, it } from 'vitest'
import { AccountHeaderSearch } from './AccountHeaderSearch'

const items = [{ id: 'mfa', label: 'Authenticator app', category: 'Security', keywords: ['MFA'], to: '/security#mfa' }]
function Search({ mode = 'features' }: { mode?: 'features' | 'members' }) {
  const [value, onChange] = useState('')
  return <AccountHeaderSearch mode={mode} value={value} onChange={onChange} items={items} />
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
it('keeps an applied member query visible and clearable after collapsing', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><Search mode="members" /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: 'Search members' }))
  await user.type(screen.getByRole('searchbox'), 'Alice{Enter}')
  expect(screen.getByText('Alice')).toBeVisible()
  expect(screen.getByText('Alice')).not.toHaveAttribute('title')
  await user.click(within(screen.getByText('Alice').parentElement!).getByRole('button', { name: 'Clear search' }))
  expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
