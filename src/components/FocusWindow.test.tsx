import { act, fireEvent, render, screen } from '@testing-library/react'
import { Button, Input, Label, TextField } from '@hallelujahhomechurch/ui'
import { expect, it, vi } from 'vitest'

it('preserves focus on press while ignoring Window focus events', () => {
  const errors = vi.fn((event: ErrorEvent) => event.preventDefault())
  window.addEventListener('error', errors)
  try {
    render(<><TextField><Label>Email</Label><Input /></TextField><Button preventFocusOnPress>Keep input focus</Button></>)
    const input = screen.getByRole('textbox', {name: 'Email'})
    input.focus()
    fireEvent.mouseDown(screen.getByRole('button', {name: 'Keep input focus'}))
    window.dispatchEvent(new FocusEvent('focus'))
    expect(errors).not.toHaveBeenCalled()
    input.focus()
    expect(input).toHaveFocus()
  } finally { window.removeEventListener('error', errors) }
})


it('accepts iframe Nodes without breaking keyboard focus', async () => {
  const {default: userEvent} = await import('@testing-library/user-event')
  const errors = vi.fn((event: ErrorEvent) => event.preventDefault())
  const iframe = document.createElement('iframe')
  document.body.append(iframe)
  const foreign = iframe.contentDocument!.createElement('button')
  iframe.contentDocument!.body.append(foreign)
  window.addEventListener('error', errors)
  try {
    render(<><input aria-label="First" /><Button preventFocusOnPress>Preserve</Button><input aria-label="Last" /></>)
    screen.getByRole('textbox', {name: 'First'}).focus()
    fireEvent.mouseDown(screen.getByRole('button', {name: 'Preserve'}))
    const event = new FocusEvent('focus')
    Object.defineProperty(event, 'target', {value: foreign})
    window.dispatchEvent(event)
    expect(errors).not.toHaveBeenCalled()
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
    await userEvent.tab()
    expect(screen.getByRole('button', {name: 'Preserve'})).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('textbox', {name: 'Last'})).toHaveFocus()
  } finally { window.removeEventListener('error', errors); iframe.remove() }
})
