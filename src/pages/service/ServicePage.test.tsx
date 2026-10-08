import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/auth-context'
import { LocaleProvider } from '../../i18n/locale-context'
import { ServicePage } from './ServicePage'
vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
const api = { listTeams: vi.fn(), listAssignments: vi.fn() }
const item = {
  id: 'one',
  teamId: 'team',
  teamName: 'Worship',
  label: 'Lead worship',
  assigneeMemberId: 'me',
  assigneeName: 'Ray',
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 3600000).toISOString(),
  timeZone: 'Asia/Taipei',
  meetingName: 'Sunday',
  version: 1,
}
beforeEach(() => {
  vi.clearAllMocks()
  api.listTeams.mockResolvedValue([
    { id: 'team', name: 'Worship', memberId: 'me' },
  ])
  api.listAssignments.mockResolvedValue([item])
  vi.mocked(useAuth).mockReturnValue({
    serviceApi: api,
    profile: { id: 'account' },
  } as never)
})
function mount() {
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <ServicePage />
      </LocaleProvider>
    </MemoryRouter>,
  )
}
it('loads own published assignments and excludes admin controls', async () => {
  mount()
  expect(
    await screen.findByRole('link', { name: /Lead worship/ }),
  ).toBeInTheDocument()
  expect(screen.queryByText('Publish')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'My service' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
it('keeps teammate duties in the fellowship view only', async () => {
  api.listAssignments.mockResolvedValue([{ ...item, assigneeMemberId: 'peer' }])
  mount()
  expect(
    await screen.findByText('No service scheduled this month'),
  ).toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: 'Fellowship roster' }),
  )
  expect(
    await screen.findByRole('link', { name: /Lead worship/ }),
  ).toBeInTheDocument()
})
it('recovers after a failed load without showing a false empty state', async () => {
  api.listTeams.mockRejectedValueOnce(new Error('offline'))
  mount()
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(
    screen.queryByText('No service scheduled this month'),
  ).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() =>
    expect(
      screen.getByRole('link', { name: /Lead worship/ }),
    ).toBeInTheDocument(),
  )
})
it('ignores a late roster response after changing the month', async () => {
  let resolveOld!: (items: unknown[]) => void
  api.listAssignments
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      }),
    )
    .mockResolvedValue([])
  mount()
  await waitFor(() => expect(api.listAssignments).toHaveBeenCalledOnce())
  await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(
    await screen.findByText('No service scheduled this month'),
  ).toBeInTheDocument()
  resolveOld([item])
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: /Lead worship/ }),
    ).not.toBeInTheDocument(),
  )
})
