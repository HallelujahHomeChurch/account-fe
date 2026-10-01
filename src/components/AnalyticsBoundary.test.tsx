// @vitest-environment-options {"url":"https://account.alive.org.tw/"}
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../i18n/locale-context'
import { AnalyticsBoundary } from './AnalyticsBoundary'
const state = vi.hoisted(() => ({
  started: false,
  sync: vi.fn(),
  dispose: vi.fn(),
  track: vi.fn(),
}))
vi.mock('@hallelujahhomechurch/preferences', async (original) => ({
  ...(await original<typeof import('@hallelujahhomechurch/preferences')>()),
  createAnalyticsController: () => ({
    sync: (route: unknown) => {
      state.sync(route)
      if (route) state.started = true
    },
    requiresDocumentNavigation: () => state.started,
    dispose: state.dispose,
    track: state.track,
  }),
}))
afterEach(() => vi.unstubAllEnvs())
function Safe() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/security')}>Go to security</button>
}
it('prevents a sensitive component from mounting after analytics starts', async () => {
  vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST12345')
  state.started = false
  const mounted = vi.fn()
  function Sensitive() {
    mounted()
    return <p>Sensitive content</p>
  }
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <LocaleProvider>
        <AnalyticsBoundary>
          <Routes>
            <Route path="/profile" element={<Safe />} />
            <Route path="/security" element={<Sensitive />} />
          </Routes>
        </AnalyticsBoundary>
      </LocaleProvider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(state.sync).toHaveBeenCalledWith('profile'))
  await userEvent.click(screen.getByRole('button', { name: 'Go to security' }))
  expect(mounted).not.toHaveBeenCalled()
  expect(screen.queryByText('Sensitive content')).not.toBeInTheDocument()
  expect(state.sync).toHaveBeenCalledWith(null)
})
