import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { useAuthCapabilitiesState } from './SocialAuthOptions'

it('reports enforced capabilities with missing versions as unavailable', async () => {
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}),
    getAuthCapabilities: async () => ({ providers: [], registrationEnabled: true, policy: { enforced: true, terms_version: '', privacy_notice_version: 'privacy-v1' } }),
  }
  render(<AuthProvider api={api} restoreSession={false}><CapabilitiesProbe /></AuthProvider>)
  expect(await screen.findByText('unavailable')).toBeInTheDocument()
})

function CapabilitiesProbe() {
  const state = useAuthCapabilitiesState()
  return <div role="alert">{state.error ? 'unavailable' : state.capabilities ? 'ready' : 'loading'}</div>
}
