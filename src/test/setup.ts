import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverMock as typeof ResizeObserver

if (!document.elementFromPoint) {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => (document.activeElement instanceof Element ? document.activeElement : document.body),
  })
}

afterEach(() => {
  cleanup()
  document.cookie = 'hhc_locale=; Max-Age=0; Path=/'
  document.cookie = 'hhc_theme=; Max-Age=0; Path=/'
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})
