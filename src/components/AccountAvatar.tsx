import { Avatar, type AvatarRootProps } from '@heroui/react'

import { accountInitials } from '../lib/account-display'
import type { Profile } from '../lib/api'

type AccountAvatarProps = {
  profile: Pick<Profile, 'avatar_url' | 'email' | 'first_name' | 'last_name'>
  className?: string
  size?: AvatarRootProps['size']
}

export function AccountAvatar({ className, profile, size = 'md' }: AccountAvatarProps) {
  return (
    <Avatar className={['account-avatar', className].filter(Boolean).join(' ')} size={size} variant="soft">
      {profile.avatar_url ? <Avatar.Image src={profile.avatar_url} alt="" /> : null}
      <Avatar.Fallback>{accountInitials(profile)}</Avatar.Fallback>
    </Avatar>
  )
}
