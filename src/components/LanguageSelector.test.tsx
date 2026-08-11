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

  return screen.getByRole('button', { name: /language/i })
}

describe('LanguageSelector', () => {
  it('shows all product locales with full accessible names', async () => {
    const trigger = renderLanguageSelector()

    await userEvent.click(trigger)

    for (const language of ['繁體中文', '简体中文', 'English', '日本語', '한국어']) {
      expect(screen.getByRole('option', { name: language })).toBeInTheDocument()
    }
  })

  it('closes when clicking outside the open menu', async () => {
    const user = userEvent.setup()
    const trigger = renderLanguageSelector()

    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes the open menu with Escape', async () => {
    const user = userEvent.setup()
    const trigger = renderLanguageSelector()

    await user.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
