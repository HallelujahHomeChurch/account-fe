import { ApiError, type Device, type LinkedAccount, type MfaSetup, type Profile } from './api'

const token = 'mock-access-token'

export class MockAccountApi {
  private profile: Profile = {
    id: 'mock-admin',
    email: 'admin',
    first_name: 'Mock',
    last_name: 'Admin',
    avatar_url: '',
    is_active: true,
    is_email_verified: true,
    has_password: true,
    roles: ['admin'],
    permissions: ['*'],
    mfa: { enabled: false },
  }

  private devices: Device[] = [
    {
      session_id: 'mock-device-1',
      user_agent: 'Mock browser session',
      ip_address: '127.0.0.1',
    },
  ]

  private linkedAccounts: LinkedAccount[] = [{ provider: 'google', provider_id: 'mock-google' }]

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
    return this.profile
  }

  async updateProfile(body: { first_name: string; last_name: string }) {
    this.profile = { ...this.profile, ...body }
    return { message: 'Profile updated.' }
  }

  async uploadAvatar() {
    const avatarUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    this.profile = { ...this.profile, avatar_url: avatarUrl }
    return { avatar_url: avatarUrl }
  }

  async deleteAvatar() {
    this.profile = { ...this.profile, avatar_url: '' }
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

  async logoutDevice(sessionId: string) {
    this.devices = this.devices.filter((device) => device.session_id !== sessionId)
  }

  async listLinkedAccounts() {
    return this.linkedAccounts
  }

  async unlinkAccount(provider: string) {
    this.linkedAccounts = this.linkedAccounts.filter((account) => account.provider !== provider)
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

  getSocialLoginUrl(provider: string) {
    return `/login?mock_social=${encodeURIComponent(provider)}`
  }
}
