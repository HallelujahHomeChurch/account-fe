import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LocaleProvider } from '../i18n/locale-context'
import { LanguageSelector } from './LanguageSelector'

function renderLanguageSelector() {
  render(
    <LocaleProvider>
      <LanguageSelector />
      <button type="button">Outside</button>
    </LocaleProvider>,
  )

  const trigger = screen.getByLabelText('Language')
  const details = trigger.closest('details')
  if (!(details instanceof HTMLDetailsElement)) throw new Error('Language selector details not found')

  return { details, trigger }
}

describe('LanguageSelector', () => {
  it('closes when clicking outside the open menu', async () => {
    const user = userEvent.setup()
    const { details, trigger } = renderLanguageSelector()

    await user.click(trigger)
    expect(details.open).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Outside' }))
    expect(details.open).toBe(false)
  })

  it('closes the open menu with Escape', async () => {
    const user = userEvent.setup()
    const { details, trigger } = renderLanguageSelector()

    await user.click(trigger)
    expect(details.open).toBe(true)

    await user.keyboard('{Escape}')
    expect(details.open).toBe(false)
  })
})
