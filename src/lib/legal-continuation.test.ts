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

it('preserves exact bulletin selectors and reader paths without accepting identity or redirect parameters', () => {
  for (const suffix of [
    '/zh-Hant/literature-ministry?series=general&issueNumber=1733&contentLocale=en&mode=online',
    '/ja/literature-ministry?series=children&page=2&mode=pdf',
    '/ja/literature-ministry?series=children&contentLocale=en&mode=online',
    '/ko/literature-ministry/1733/read/children/en',
  ]) {
    const url = `https://www.alive.org.tw${suffix}`
    expect(legalContinuation(url)).toBe(url)
  }
  for (const suffix of [
    '/en/literature-ministry?issueNumber=1733',
    '/en/literature-ministry?series=children&issueNumber=1733&contentLocale=zh-Hans',
    '/en/literature-ministry?series=general&series=children',
    '/en/literature-ministry?series=general&issueNumber=2147483648&contentLocale=en',
    '/en/literature-ministry?series=general&issueNumber=01733&contentLocale=en',
    '/en/literature-ministry?return_to=https://evil.test',
    '/en/literature-ministry?accountId=someone',
    '/en/literature-ministry?__proto__=general',
    '/en/literature-ministry/1733/read/children/zh-Hans',
    '/en/literature-ministry/1733/read/general/en?token=secret',
    '/en/literature-ministry/1733/read/general/en#secret',
  ]) expect(legalContinuation(`https://www.alive.org.tw${suffix}`)).toBeNull()
})


it('preserves only canonical video IDs and bounded playback time', () => {
  const base = 'https://www.alive.org.tw/video/FA0AoBO02uU'
  for (const suffix of ['', '?t=0', '?t=604800']) {
    expect(legalContinuation(base + suffix)).toBe(base + suffix)
  }
  for (const suffix of ['?t=604801', '?t=-1', '?t=1.5', '?t=01', '?t=1&t=2', '?token=x', '?t=1&token=x', '#secret', '?t=%31']) {
    expect(legalContinuation(base + suffix)).toBeNull()
  }
  for (const path of ['/video/short', '/video/FA0AoBO02uU/extra', '/video/FA0AoBO02u!', '/video/FA0AoBO02uU/']) {
    expect(legalContinuation('https://www.alive.org.tw' + path)).toBeNull()
  }
  expect(legalContinuation('https://user@www.alive.org.tw/video/FA0AoBO02uU')).toBeNull()
  expect(legalContinuation('https://evil.test/video/FA0AoBO02uU')).toBeNull()
})
