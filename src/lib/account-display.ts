import type { Profile } from './api'

export function displayAccountName(
  profile: Pick<Profile, 'email' | 'nickname' | 'first_name' | 'last_name'>,
  fallback = 'Account profile',
) {
  const name = profile.nickname ?? [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean).join(' ')
  return name || fallback
}

export function accountGreetingName(profile: Pick<Profile, 'email' | 'nickname' | 'first_name' | 'last_name'>, fallback = 'Member') {
  return displayAccountName(profile, fallback)
}

export function accountInitials(profile: Pick<Profile, 'email' | 'nickname' | 'first_name' | 'last_name'>) {
  const name = displayAccountName(profile, '').trim()
  const words = name.split(/\s+/)
  const initials = words.length > 1 ? words.slice(0, 2).map((word) => Array.from(word)[0]).join('') : Array.from(name).slice(0, 2).join('')
  return (initials || 'HH').toUpperCase()
}
