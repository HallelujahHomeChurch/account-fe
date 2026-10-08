import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Turnstile } from './Turnstile'

afterEach(() => {
  delete window.turnstile
  document.getElementById('cloudflare-turnstile-script')?.remove()
})

it('clears a stale token on challenge failure and offers a manual retry', () => {
  const onToken = vi.fn()
  const renderWidget = vi.fn().mockReturnValue('widget')
  window.turnstile = { render: renderWidget, remove: vi.fn() }
  render(<Turnstile siteKey="test" onToken={onToken} />)
  const options = renderWidget.mock.calls[0][1]
  act(() => options.callback('stale-token'))
  let handled: unknown
  act(() => { handled = options['error-callback']?.('300010') })
  expect(handled).toBe(true)
  expect(onToken).toHaveBeenLastCalledWith('')
  expect(screen.getByRole('alert')).toHaveTextContent('Verification is unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(renderWidget).toHaveBeenCalledTimes(2)
  act(() => renderWidget.mock.calls[1][1].callback('fresh-token'))
  expect(onToken).toHaveBeenLastCalledWith('fresh-token')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('handles a script load failure and replaces it only on explicit retry', () => {
  const onToken = vi.fn()
  const view = render(<Turnstile siteKey="test" onToken={onToken} />)
  const script = document.getElementById('cloudflare-turnstile-script')!
  fireEvent.error(script)
  expect(onToken).toHaveBeenLastCalledWith('')
  expect(screen.getByRole('alert')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(document.getElementById('cloudflare-turnstile-script')).not.toBe(script)
  view.unmount()
  onToken.mockClear()
  fireEvent.error(script)
  expect(onToken).not.toHaveBeenCalled()
})

it('uses an existing loading script, clears expired tokens and removes the widget on unmount', () => {
  const script = document.createElement('script')
  script.id = 'cloudflare-turnstile-script'
  document.head.append(script)
  const onToken = vi.fn()
  const view = render(<Turnstile siteKey="test" onToken={onToken} />)
  const renderWidget = vi.fn().mockReturnValue('widget')
  const remove = vi.fn()
  window.turnstile = { render: renderWidget, remove }
  fireEvent.load(script)
  expect(renderWidget).toHaveBeenCalledOnce()
  act(() => renderWidget.mock.calls[0][1]['expired-callback']())
  expect(onToken).toHaveBeenLastCalledWith('')
  view.unmount()
  expect(remove).toHaveBeenCalledWith('widget')
  fireEvent.load(script)
  expect(renderWidget).toHaveBeenCalledOnce()
})
