import { Avatar, type AvatarProps } from '@hallelujahhomechurch/ui'

import { accountGreetingName } from '../lib/account-display'
import type { Profile } from '../lib/api'

type AccountAvatarProps = {
  profile: Pick<Profile, 'avatar_url' | 'email' | 'first_name' | 'last_name'>
  className?: string
  size?: AvatarProps['size']
}

export function AccountAvatar({ className, profile, size = 'md' }: AccountAvatarProps) {
  return (
    <Avatar
      className={['account-avatar', className].filter(Boolean).join(' ')}
      name={accountGreetingName(profile)}
      size={size}
      src={profile.avatar_url}
    />
  )
}
