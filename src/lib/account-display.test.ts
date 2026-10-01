import { describe, expect, it } from 'vitest'
import { accountInitials, displayAccountName } from './account-display'

describe('account nickname display', () => {
  it('uses the current nickname and preserves an explicitly empty nickname', () => {
    const profile = { email: 'private@example.com', first_name: 'Legacy', last_name: 'Name' }
    expect(displayAccountName({ ...profile, nickname: 'Chosen alias' }, 'Member')).toBe('Chosen alias')
    expect(displayAccountName({ ...profile, nickname: '' }, 'Member')).toBe('Member')
    expect(displayAccountName(profile, 'Member')).toBe('Legacy Name')
    expect(displayAccountName({ email: 'private@example.com' }, 'Member')).toBe('Member')
    expect(accountInitials({ ...profile, nickname: '小明' })).toBe('小明')
  })
})
