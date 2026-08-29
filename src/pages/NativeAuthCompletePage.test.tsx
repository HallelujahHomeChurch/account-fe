import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '../i18n/locale-context'
import { NativeAuthCompletePage } from './NativeAuthCompletePage'
import { openNativeAuthCallback } from '../lib/redirects'

vi.mock('../lib/redirects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/redirects')>()
  return {
    ...actual,
    readNativeAuthCallback: () =>
      'hhc-presenter://auth/account?code=issued-code&state=issued-state',
    openNativeAuthCallback: vi.fn(),
  }
})

describe('NativeAuthCompletePage', () => {
  it('opens HHC Presenter and leaves a manual retry page', () => {
    window.history.replaceState(null, '', '/native-auth-complete#callback=opaque')

    render(
      <MemoryRouter>
        <LocaleProvider>
          <NativeAuthCompletePage />
        </LocaleProvider>
      </MemoryRouter>,
    )

    expect(window.location.hash).toBe('')
    expect(openNativeAuthCallback).toHaveBeenCalledWith(
      'hhc-presenter://auth/account?code=issued-code&state=issued-state',
    )
    expect(screen.getByRole('heading', { name: 'Sign-in complete' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open HHC Presenter' }))
    expect(openNativeAuthCallback).toHaveBeenCalledTimes(2)
  })
})
