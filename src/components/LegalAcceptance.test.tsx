import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { LocaleProvider } from '../i18n/locale-context'
import { LegalAcceptance } from './LegalAcceptance'

it('starts unchecked and keeps legal links separate from acceptance', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  const onChange = vi.fn()

  render(<LocaleProvider><LegalAcceptance checked={false} onChange={onChange} /></LocaleProvider>)

  const checkbox = screen.getByRole('checkbox', { name: /I agree to the Terms of Use and acknowledge the Privacy Notice/i })
  expect(checkbox).not.toBeChecked()
  expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', 'https://www.alive.org.tw/en/terms-of-use')
  expect(screen.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute('href', 'https://www.alive.org.tw/en/privacy-policy')

  await userEvent.click(screen.getByRole('link', { name: 'Terms of Use' }))
  expect(onChange).not.toHaveBeenCalled()
  await userEvent.click(checkbox)
  expect(onChange).toHaveBeenCalledWith(true)
})
