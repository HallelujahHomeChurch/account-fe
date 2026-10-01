import { Avatar, type AvatarProps } from '@hallelujahhomechurch/ui'

import { useLocale } from '../i18n/locale-context'
import { accountGreetingName } from '../lib/account-display'
import type { Profile } from '../lib/api'

type AccountAvatarProps = {
  profile: Pick<Profile, 'avatar_url' | 'email' | 'nickname' | 'first_name' | 'last_name'>
  className?: string
  size?: AvatarProps['size']
}

export function AccountAvatar({ className, profile, size = 'md' }: AccountAvatarProps) {
  const { messages: t } = useLocale()
  return (
    <Avatar
      className={['account-avatar', className].filter(Boolean).join(' ')}
      name={accountGreetingName(profile, t.profile.fallbackName)}
      size={size}
      src={profile.avatar_url}
    />
  )
}
