import { expect, it } from 'vitest'
import { legalContinuation } from './legal-continuation'
it('accepts only bounded resource routes or fixed public-site destinations', () => {
  expect(legalContinuation('/resources/room')).toBe('/resources/room')
  expect(legalContinuation('https://www.alive.org.tw/en/member-videos')).toBe(
    'https://www.alive.org.tw/en/member-videos',
  )
  for (const value of [
    '//evil.test',
    'https://evil.test/en/member-videos',
    '/security',
    'https://user@www.alive.org.tw/en/member-videos',
    'https://www.alive.org.tw/en/member-videos?token=private',
    '/resources/../security',
  ])
    expect(legalContinuation(value)).toBeNull()
})
