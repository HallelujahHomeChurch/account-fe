/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

function declarationsFor(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm'))
  if (!match) throw new Error(`Missing CSS rule for ${selector}`)
  return match[1]
}

function declaration(selector: string, property: string) {
  const match = declarationsFor(selector).match(new RegExp(`${property}:\\s*([^;]+);`))
  if (!match) throw new Error(`Missing ${property} declaration for ${selector}`)
  return match[1].trim()
}

describe('LanguageSelector styles', () => {
  it('keeps the login language trigger compact with menu-aligned corners', () => {
    expect(declaration('.language-selector-trigger', 'min-height')).toBe('34px')
    expect(declaration('.language-selector-trigger', 'min-width')).toBe('82px')
    expect(declaration('.language-selector-trigger', 'font-size')).toBe('13px')
    expect(declaration('.language-selector-trigger', 'border-radius')).toBe(
      declaration('.language-selector-menu', 'border-radius'),
    )
  })

  it('hides the native summary marker', () => {
    expect(declaration('.language-selector summary::marker', 'content')).toBe('""')
  })
})
