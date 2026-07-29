import { ApiError, type Device, type LineBindingSummary, type LinkedAccount, type MfaSetup, type Profile } from './api'

const token = 'mock-access-token'
const mockTimestamp = (millisecondsAgo: number) => new Date(Date.now() - millisecondsAgo).toISOString()

export class MockAccountApi {
  private profile: Profile = {
    id: 'mock-admin',
    email: 'admin',
    first_name: 'Mock',
    last_name: 'Admin',
    avatar_url: '',
    avatar_source: 'none',
    avatar_status: 'none',
    is_active: true,
    is_email_verified: true,
    has_password: true,
    roles: ['admin'],
    permissions: ['*'],
    mfa: { enabled: false },
  }

  private devices: Device[] = [
    {
      id: 'mock-device-1',
      display_name: 'Chrome on macOS',
      device_type: 'desktop',
      browser: 'Chrome',
      os: 'macOS',
      ip_address: '127.0.0.1',
    first_seen_at: mockTimestamp(30 * 24 * 60 * 60 * 1000),
    last_login_at: mockTimestamp(2 * 60 * 60 * 1000),
    last_active_at: mockTimestamp(10 * 60 * 1000),
      is_current: true,
      is_signed_in: true,
    },
  ]

  private linkedAccounts: LinkedAccount[] = [{ provider: 'google', provider_id: 'mock-google' }]
  private avatarPolls = 0

  async login(request: { email: string; password: string }) {
    if (request.email !== 'admin' || request.password !== 'admin123') {
      throw new ApiError(401, 'Mock login accepts admin / admin123')
    }

    return { access_token: token }
  }

  async refreshAccessToken() {
    return null
  }

  async me() {
    if (this.profile.avatar_status === 'processing' && ++this.avatarPolls >= 2) {
      this.profile = {
        ...this.profile,
        avatar_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        avatar_source: 'custom',
        avatar_status: 'ready',
      }
    }
    return this.profile
  }

  async updateProfile(body: { first_name: string; last_name: string }) {
    this.profile = { ...this.profile, ...body }
    return { message: 'Profile updated.' }
  }

  async uploadAvatar() {
    this.avatarPolls = 0
    this.profile = { ...this.profile, avatar_status: 'processing' }
    return { avatar_url: this.profile.avatar_url ?? '', avatar_status: 'processing' as const }
  }

  async deleteAvatar() {
    this.profile = { ...this.profile, avatar_url: '', avatar_source: 'none', avatar_status: 'none' }
  }

  async changePassword() {
    return { message: 'Password changed.' }
  }

  async setupMfa(): Promise<MfaSetup> {
    return {
      otpauth_url: 'otpauth://totp/HHC:admin?secret=MOCK123&issuer=HHC',
      backup_codes: ['11111111', '22222222', '33333333'],
    }
  }

  async verifyMfaSetup() {
    this.profile = { ...this.profile, mfa: { enabled: true } }
    return { message: 'MFA enabled.' }
  }

  async disableMfa() {
    this.profile = { ...this.profile, mfa: { enabled: false } }
    return { message: 'MFA disabled.' }
  }

  async regenerateBackupCodes() {
    return { backup_codes: ['44444444', '55555555', '66666666'] }
  }

  async listDevices() {
    return this.devices
  }

  async logoutDevice(deviceId: string) {
    this.devices = this.devices.map((device) =>
      device.id === deviceId ? { ...device, is_signed_in: false } : device,
    )
  }

  async listLinkedAccounts() {
    return this.linkedAccounts
  }

  async unlinkAccount(provider: string) {
    this.linkedAccounts = this.linkedAccounts.filter((account) => account.provider !== provider)
  }

  async getLineBinding(token: string): Promise<LineBindingSummary> {
    if (token === 'expired') {
      throw new ApiError(410, 'This link has expired.', 'ACC_LINE_BINDING_INVALID')
    }
    return {
      profile_name: 'HHC_LINE_Helper',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }
  }

  async confirmLineBinding(token: string) {
    if (token === 'conflict') {
      throw new ApiError(409, 'LINE account already linked.', 'ACC_LINE_IDENTITY_CONFLICT')
    }
    return { message: 'LINE account linked successfully' }
  }

  async forgotPassword() {
    return { message: 'Mock reset email accepted.' }
  }

  async resetPassword() {
    return { message: 'Mock password reset accepted.' }
  }

  async verifyEmail() {
    this.profile = { ...this.profile, is_email_verified: true }
    return { message: 'Email verified successfully' }
  }

  async logout() {
    return { message: 'Signed out.' }
  }

  async logoutAll() {
    return
  }

  getSocialLoginUrl(provider: string) {
    return `/login?mock_social=${encodeURIComponent(provider)}`
  }

  async getOAuthProviders() {
    return ['google', 'line', 'microsoft']
  }
}
