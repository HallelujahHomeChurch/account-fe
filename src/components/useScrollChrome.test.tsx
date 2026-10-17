import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useScrollChrome } from './useScrollChrome'

function Chrome({ blocked = false, scope = 'profile' }) {
  const { visible } = useScrollChrome({ blocked, resetKey: scope })
  return <div data-testid="chrome" data-visible={visible} />
}
it('reveals chrome on upward scroll and pins it during search or route changes', async () => {
  let y = 0
  const spy = vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y)
  try {
    const view = render(<Chrome />)
    y = 50
    fireEvent.scroll(window)
    await waitFor(() => expect(screen.getByTestId('chrome')).toHaveAttribute('data-visible', 'false'))
    y = 25
    fireEvent.scroll(window)
    await waitFor(() => expect(screen.getByTestId('chrome')).toHaveAttribute('data-visible', 'true'))
    view.rerender(<Chrome blocked />)
    y = 200
    fireEvent.scroll(window)
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
    expect(screen.getByTestId('chrome')).toHaveAttribute('data-visible', 'true')
    view.rerender(<Chrome scope="security" />)
    expect(screen.getByTestId('chrome')).toHaveAttribute('data-visible', 'true')
  } finally { spy.mockRestore() }
})
