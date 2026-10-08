import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../../auth/auth-context'
import { LocaleProvider } from '../../i18n/locale-context'
import { ServiceNotices } from './ServiceNotices'
vi.mock('../../auth/auth-context', () => ({ useAuth: vi.fn() }))
const api = { listNotices: vi.fn(), readNotice: vi.fn() }
const notice = {
  id: 'notice',
  assignmentId: 'assignment',
  kind: 'request',
  createdAt: '2026-10-09T00:00:00Z',
}
beforeEach(() => {
  vi.clearAllMocks()
  api.listNotices.mockResolvedValue([notice])
  api.readNotice.mockResolvedValue({ ok: true })
  vi.mocked(useAuth).mockReturnValue({ serviceApi: api } as never)
})
function mount() {
  render(
    <MemoryRouter initialEntries={['/service/notifications']}>
      <LocaleProvider>
        <Routes>
          <Route path="/service/notifications" element={<ServiceNotices />} />
          <Route
            path="/service/assignments/:id"
            element={<h1>Assignment</h1>}
          />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  )
}
it('opens the assignment without waiting on the read receipt', async () => {
  api.readNotice.mockReturnValue(new Promise(() => {}))
  mount()
  await userEvent.click(
    await screen.findByRole('button', { name: /Substitution invitation/ }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Assignment' }),
  ).toBeInTheDocument()
  expect(api.readNotice).toHaveBeenCalledWith('notice')
})
it('keeps prior notices when loading the next page fails', async () => {
  api.listNotices
    .mockResolvedValueOnce(
      Array.from({ length: 100 }, (_, i) => ({ ...notice, id: `notice-${i}` })),
    )
    .mockRejectedValueOnce(new Error('offline'))
  mount()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Load more' }),
  )
  await screen.findByRole('alert')
  expect(
    screen.getAllByRole('button', { name: /Substitution invitation/ }),
  ).toHaveLength(100)
  expect(api.listNotices).toHaveBeenLastCalledWith(
    'notice-99',
    expect.any(AbortSignal),
  )
})
