import { expect, it } from 'vitest'
import { findAccountFeatures } from './account-feature-search'

const items = [
  { id: 'mfa', label: 'Two-factor authentication', category: 'Security', keywords: ['MFA', '2FA'], to: '/security#mfa' },
  { id: 'language', label: '語言', category: '個人化', keywords: ['language'], to: '/profile#language' },
]
it('matches translated labels, categories and aliases without changing available destinations', () => {
  expect(findAccountFeatures(items, '  mFa  ').map(item => item.to)).toEqual(['/security#mfa'])
  expect(findAccountFeatures(items, '語言').map(item => item.to)).toEqual(['/profile#language'])
  expect(findAccountFeatures(items, 'security').map(item => item.id)).toEqual(['mfa'])
  expect(findAccountFeatures(items, 'missing')).toEqual([])
  expect(findAccountFeatures(items, '   ')).toEqual([])
})
it('searches only the caller-provided available items', () => {
  expect(findAccountFeatures(items.slice(1), 'MFA')).toEqual([])
})
