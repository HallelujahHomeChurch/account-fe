import { Form } from '@hallelujahhomechurch/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { LocaleProvider } from '../i18n/locale-context'
import { messages } from '../i18n/messages'
import type { Locale } from '../i18n/locales'
import { PasswordField } from './PasswordField'

it.each(['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'] as Locale[])('supports localized keyboard visibility without submitting in %s', async locale => {
  document.cookie = `hhc_locale=${locale}; Path=/`
  const submit = vi.fn(event => event.preventDefault())
  const label = messages[locale].registration.password
  const { show, hide } = messages[locale].passwordVisibility
  render(<LocaleProvider><Form onSubmit={submit}>
    <PasswordField name="password" label={label} autoComplete="new-password" />
  </Form></LocaleProvider>)
  const input = screen.getByLabelText(label)
  await userEvent.tab()
  expect(input).toHaveFocus()
  await userEvent.type(input, 'Synthetic1')
  await userEvent.tab()
  expect(screen.getByRole('button', { name: `${show}: ${label}` })).toHaveFocus()
  await userEvent.keyboard(' ')
  expect(input).toHaveAttribute('type', 'text')
  expect(input).toHaveValue('Synthetic1')
  expect(screen.getByRole('button', { name: `${hide}: ${label}` })).toHaveFocus()
  await userEvent.keyboard('{Enter}')
  expect(input).toHaveAttribute('type', 'password')
  expect(input).toHaveAttribute('autocomplete', 'new-password')
  expect(new FormData(input.closest('form')!).get('password')).toBe('Synthetic1')
  expect(submit).not.toHaveBeenCalled()
})
