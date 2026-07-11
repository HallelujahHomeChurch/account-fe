import type { Profile } from './api'

export function displayAccountName(
  profile: Pick<Profile, 'email' | 'first_name' | 'last_name'>,
  fallback = 'Account profile',
) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || emailLocalPart(profile.email) || fallback
}

export function accountGreetingName(profile: Pick<Profile, 'email' | 'first_name' | 'last_name'>) {
  return displayAccountName(profile, 'there')
}

export function accountInitials(profile: Pick<Profile, 'email' | 'first_name' | 'last_name'>) {
  const nameInitials = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .map((part) => part?.trim().charAt(0))
    .join('')

  return (nameInitials || emailLocalPart(profile.email).slice(0, 2) || 'HH').toUpperCase()
}

function emailLocalPart(email: string) {
  return email.split('@')[0] ?? ''
}
