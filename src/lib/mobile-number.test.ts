import { describe, expect, it } from 'vitest'
import { normalizeMobile, splitMobile } from './mobile-number'

describe('member mobile normalization', () => {
 it.each(['0934058627', '934058627', '0934-058-627', '０９３４０５８６２７', '+886 934 058 627'])('normalizes Taiwan input %s', input => {
  expect(normalizeMobile(input, 'TW')).toBe('+886934058627')
 })
 it('uses country rules instead of blindly removing leading zeros', () => {
  expect(normalizeMobile('020 7946 0018', 'GB')).toBe('+442079460018')
  expect(normalizeMobile('02 36618 300', 'IT')).toBe('+390236618300')
  expect(normalizeMobile('202-555-0123', 'US')).toBe('+12025550123')
 })
 it('accepts an explicit international number without duplicating the selected prefix', () => {
  expect(normalizeMobile('+81 90 1234 5678', 'TW')).toBe('+819012345678')
 })
 it('preserves empty and unrecognized existing E.164 values without guessing', () => {
  expect(normalizeMobile('   ', 'TW')).toBeNull()
  expect(normalizeMobile('+999123456789', 'TW')).toBe('+999123456789')
  expect(splitMobile('+999123456789')).toEqual({ country: 'TW', number: '+999123456789' })
 })
 it('does not silently strip text or phone extensions into a different number', () => {
  expect(normalizeMobile('call 0934058627', 'TW')).not.toBe('+886934058627')
  expect(normalizeMobile('0934058627 ext.123', 'TW')).not.toBe('+886934058627')
 })
 it('splits stored numbers and preserves significant zeros', () => {
  expect(splitMobile('+886934058627')).toEqual({ country: 'TW', number: '934058627' })
  expect(splitMobile('+390236618300')).toEqual({ country: 'IT', number: '0236618300' })
  expect(splitMobile(null)).toEqual({ country: 'TW', number: '' })
  expect(normalizeMobile(splitMobile('+80012345678').number, splitMobile('+80012345678').country)).toBe('+80012345678')
 })
})
