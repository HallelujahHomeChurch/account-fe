import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { DevicesPage } from './DevicesPage'

function deviceApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: async () => ({ access_token: 'token' }),
    refreshAccessToken: async () => 'token',
    me: async () => ({ id: 'u1', email: 'ray@example.com' }),
    logout: async () => ({}),
    ...overrides,
  }
}

describe('DevicesPage', () => {
  it('shows a load error without also claiming that there are no devices', async () => {
    render(
      <MemoryRouter>
        <AuthProvider api={deviceApi({ listDevices: async () => { throw new Error('offline') } })}>
          <DevicesPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load devices')
    expect(screen.queryByText('No recognized devices yet.')).not.toBeInTheDocument()
  })

  it('separates the current device from other device rows', async () => {
    render(
      <MemoryRouter>
        <AuthProvider
          api={deviceApi({
            listDevices: async () => [
              {
                id: 'old',
                display_name: 'Old iPhone',
                device_type: 'mobile',
                browser: 'Safari',
                os: 'iOS',
                ip_address: '203.0.113.20',
                first_seen_at: '2026-07-01T00:00:00Z',
                last_login_at: '2026-07-02T00:00:00Z',
                last_active_at: '2026-07-03T00:00:00Z',
                is_current: false,
                is_signed_in: false,
              },
              {
                id: 'remote',
                display_name: 'Work Mac',
                device_type: 'desktop',
                browser: 'Chrome',
                os: 'macOS',
                ip_address: '203.0.113.30',
                first_seen_at: '2026-07-01T00:00:00Z',
                last_login_at: '2026-07-10T00:00:00Z',
                last_active_at: '2026-07-11T00:00:00Z',
                is_current: false,
                is_signed_in: true,
              },
              {
                id: 'current',
                display_name: 'This Mac',
                device_type: 'desktop',
                browser: 'Chrome',
                os: 'macOS',
                ip_address: '203.0.113.10',
                first_seen_at: '2026-07-01T00:00:00Z',
                last_login_at: '2026-07-11T00:00:00Z',
                last_active_at: '2026-07-12T00:00:00Z',
                is_current: true,
                is_signed_in: true,
              },
            ],
          })}
        >
          <DevicesPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    const rows = await screen.findAllByText(/This Mac|Work Mac|Old iPhone/)
    expect(rows.map((row) => row.textContent)).toEqual(['This Mac', 'Work Mac', 'Old iPhone'])
    expect(screen.getByRole('heading', { name: 'Current device' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Other devices' })).toBeInTheDocument()
    expect(screen.getByText('Signed out')).toBeInTheDocument()
    expect(document.querySelectorAll('.device-icon')).toHaveLength(3)
    expect(document.querySelectorAll('.device-management-row')).toHaveLength(3)
    expect(screen.getAllByText('Last active')).toHaveLength(3)
    expect(screen.getAllByText('Last sign-in')).toHaveLength(3)
    expect(screen.getAllByText('IP address')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /sign out this mac/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out work mac/i })).toBeInTheDocument()
  })

  it('does not repeat the generated browser and operating system name', async () => {
    render(
      <MemoryRouter>
        <AuthProvider
          api={deviceApi({
            listDevices: async () => [{
              id: 'current',
              display_name: 'Chrome on macOS',
              device_type: 'desktop',
              browser: 'Chrome',
              os: 'macOS',
              ip_address: '203.0.113.10',
              first_seen_at: '2026-07-01T00:00:00Z',
              last_login_at: '2026-07-11T00:00:00Z',
              last_active_at: '2026-07-12T00:00:00Z',
              is_current: true,
              is_signed_in: true,
            }],
          })}
        >
          <DevicesPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Chrome · macOS')).toBeInTheDocument()
    expect(screen.queryByText('Chrome on macOS')).not.toBeInTheDocument()
  })

  it('revokes a remote device and keeps its activity row', async () => {
    const calls: string[] = []
    render(
      <MemoryRouter>
        <AuthProvider
          api={deviceApi({
            listDevices: async () => [{
              id: 'remote',
              display_name: 'Personal Mac',
              device_type: 'desktop',
              browser: 'Chrome',
              os: 'macOS',
              ip_address: '203.0.113.10',
              first_seen_at: '2026-07-01T00:00:00Z',
              last_login_at: '2026-07-11T00:00:00Z',
              last_active_at: '2026-07-12T00:00:00Z',
              is_current: false,
              is_signed_in: true,
            }],
            logoutDevice: async (id) => { calls.push(id) },
          })}
        >
          <DevicesPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /sign out personal mac/i }))
    expect(screen.getByRole('alertdialog', { name: 'Sign out Personal Mac?' })).toBeInTheDocument()
    expect(screen.getByText('This device will need to sign in again to use your HHC account.')).toBeInTheDocument()
    expect(calls).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: /^sign out$/i }))
    expect(calls).toEqual(['remote'])
    expect(screen.getByText('Personal Mac')).toBeInTheDocument()
    expect(screen.getByText('Signed out')).toBeInTheDocument()
  })

  it('does not expose a row-level sign-out action for the current device', async () => {
    render(
      <MemoryRouter>
        <AuthProvider
          api={deviceApi({
            listDevices: async () => [{
              id: 'current',
              display_name: 'This Mac',
              device_type: 'desktop',
              browser: 'Chrome',
              os: 'macOS',
              ip_address: '203.0.113.10',
              first_seen_at: '2026-07-01T00:00:00Z',
              last_login_at: '2026-07-11T00:00:00Z',
              last_active_at: '2026-07-12T00:00:00Z',
              is_current: true,
              is_signed_in: true,
            }],
            logoutDevice: async () => { throw new Error('current device must use account menu logout') },
          })}
        >
          <DevicesPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('This Mac')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out this mac/i })).not.toBeInTheDocument()
  })
})
