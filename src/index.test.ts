/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('account bootstrap', () => {
  it('defaults the before-paint theme to light', () => {
    expect(html).toContain("const theme = match?.[1] ?? 'light'")
    expect(html).not.toContain('prefers-color-scheme')
  })

  it('does not send the accountLink URL as a referrer', () => {
    expect(html).toContain('<meta name="referrer" content="no-referrer" />')
  })
})
