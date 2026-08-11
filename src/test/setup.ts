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

afterEach(async () => {
  const usedInputOtp = document.getElementById('input-otp-style') !== null
    || document.querySelector('[data-input-otp]') !== null
  if (usedInputOtp) {
    // input-otp leaves 50 ms timers behind after unmount; drain them before jsdom teardown.
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
  cleanup()
  document.cookie = 'hhc_locale=; Max-Age=0; Path=/'
  document.cookie = 'hhc_theme=; Max-Age=0; Path=/'
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})
