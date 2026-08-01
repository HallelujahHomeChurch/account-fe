import { describe, expect, it } from 'vitest'

import { applyTheme, getInitialTheme, getThemeCookie, getStoredTheme } from './theme'

describe('shared theme preference', () => {
  it('reads only supported values from the hhc_theme cookie', () => {
    expect(getStoredTheme('foo=bar; hhc_theme=dark')).toBe('dark')
    expect(getStoredTheme('hhc_theme=system')).toBeUndefined()
  })

  it('defaults to light when no cookie exists', () => {
    expect(getInitialTheme('', true)).toBe('light')
    expect(getInitialTheme('', false)).toBe('light')
  })

  it('builds a cross-subdomain preference cookie', () => {
    expect(getThemeCookie('dark', '.alive.org.tw')).toContain('hhc_theme=dark')
    expect(getThemeCookie('dark', '.alive.org.tw')).toContain('Domain=.alive.org.tw')
    expect(getThemeCookie('dark', '.alive.org.tw')).toContain('Max-Age=31536000')
    expect(getThemeCookie('dark', '.alive.org.tw')).toContain('SameSite=Lax')
  })

  it('applies the theme to the document root', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')

    applyTheme('light')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
