import { createAccountSessionClient } from '@hallelujahhomechurch/account-client'

export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type AccountApiOptions = {
  baseUrl: string
  fetcher?: Fetcher
  getAccessToken?: () => string | null
  setAccessToken?: (token: string | null) => void
}

export type LoginRequest = {
  email: string
  password: string
  authRequestId?: string
}

export type LoginResponse = {
  access_token?: string
  mfa_type?: 'verification_required'
  mfa_token?: string
  redirect_type?: 'oauth' | 'profile'
  redirect_uri?: string
  code?: string
  state?: string
  success?: boolean
}

export type Profile = {
  id: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  avatar_source?: 'custom' | 'provider' | 'none'
  avatar_status?: 'none' | 'processing' | 'ready' | 'failed'
  is_active?: boolean
  is_email_verified?: boolean
  has_password?: boolean
  roles?: string[]
  permissions?: string[]
  mfa?: {
    enabled: boolean
    methods?: Array<{ type: string; created_at?: string }>
  }
}

export type Device = {
  id: string
  display_name: string
  device_type: 'desktop' | 'mobile' | 'tablet' | string
  browser: string
  os: string
  ip_address: string
  first_seen_at: string
  last_login_at: string
  last_active_at: string
  is_current: boolean
  is_signed_in: boolean
}

export type LinkedAccount = {
  provider: string
  provider_id?: string
  linked_at?: string
}

export type MfaSetup = {
  otpauth_url?: string
  qr_code_url?: string
  secret?: string
  backup_codes?: string[]
}

export type LineBindingSummary = {
  profile_name: string
  expires_at: string
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  retry?: boolean
}

const csrfTokenRequests = new Map<string, Promise<string>>()
const refreshTokenRequests = new Map<string, Promise<string | null>>()

export class ApiError extends Error {
  status: number
  code?: string
  data: unknown

  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

export class AccountApi {
  private readonly baseUrl: string
  private readonly fetcher: Fetcher
  private readonly getAccessToken?: () => string | null
  private readonly setAccessToken?: (token: string | null) => void
  private csrfToken: string | null = null

  constructor(options: AccountApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    this.getAccessToken = options.getAccessToken
    this.setAccessToken = options.setAccessToken
  }

  async login(request: LoginRequest) {
    const path = request.authRequestId
      ? `/login?auth_request_id=${encodeURIComponent(request.authRequestId)}`
      : '/login'

    return this.request<LoginResponse>(path, {
      method: 'POST',
      auth: false,
      body: {
        email: request.email,
        password: request.password,
      },
    })
  }

  async refreshAccessToken() {
    let request = refreshTokenRequests.get(this.baseUrl)
    if (!request) {
      request = this.request<{ access_token?: string }>('/refresh', {
        method: 'POST',
        auth: false,
        retry: false,
        body: {},
      })
        .then((response) => response.access_token ?? null)
        .catch(() => null)
        .finally(() => {
          refreshTokenRequests.delete(this.baseUrl)
        })
      refreshTokenRequests.set(this.baseUrl, request)
    }

    const token = await request
    this.setAccessToken?.(token)
    return token
  }

  me() {
    return this.request<Profile>('/me')
  }

  updateProfile(body: { first_name: string; last_name: string }) {
    return this.request<{ message?: string }>('/profile', { method: 'PUT', body })
  }

  uploadAvatar(avatar: Blob) {
    const form = new FormData()
    form.append('avatar', avatar, 'avatar.jpg')
    return this.request<{ avatar_url: string; avatar_status: 'processing' }>('/profile/avatar', { method: 'POST', body: form })
  }

  deleteAvatar() {
    return this.request<void>('/profile/avatar', { method: 'DELETE' })
  }

  changePassword(body: { old_password: string; new_password: string }) {
    return this.request<{ message?: string }>('/change-password', { method: 'POST', body })
  }

  forgotPassword(email: string) {
    return this.request<{ message?: string }>('/forgot-password', {
      method: 'POST',
      auth: false,
      body: { email },
    })
  }

  verifyEmail(token: string) {
    return this.request<{ message?: string }>('/verify-email', {
      method: 'POST',
      auth: false,
      body: { token },
    })
  }

  resetPassword(body: { email: string; token: string; new_password: string }) {
    return this.request<{ message?: string }>('/reset-password', {
      method: 'POST',
      auth: false,
      body,
    })
  }

  setupMfa() {
    return this.request<MfaSetup>('/mfa/setup', { method: 'POST', body: {} })
  }

  verifyMfaSetup(code: string) {
    return this.request<{ message?: string }>('/mfa/verify-setup', { method: 'POST', body: { code } })
  }

  verifyMfa(mfaToken: string, code: string) {
    return this.request<LoginResponse>('/mfa/verify', {
      method: 'POST',
      auth: false,
      body: { mfa_token: mfaToken, code },
    })
  }

  disableMfa() {
    return this.request<{ message?: string }>('/mfa/disable', { method: 'POST', body: {} })
  }

  regenerateBackupCodes() {
    return this.request<{ backup_codes?: string[] }>('/mfa/regenerate-backup-codes', {
      method: 'POST',
      body: {},
    })
  }

  listDevices() {
    return this.request<Device[]>('/devices')
  }

  logoutDevice(deviceId: string) {
    return this.request<void>(`/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' })
  }

  listLinkedAccounts() {
    return this.request<LinkedAccount[]>('/linked-accounts')
  }

  unlinkAccount(provider: string) {
    return this.request<void>(`/linked-accounts/${encodeURIComponent(provider)}`, { method: 'DELETE' })
  }

  confirmOAuthLink(token: string) {
    return this.request<{ message?: string }>('/oauth/confirm-link', {
      method: 'POST',
      auth: false,
      body: { token },
    })
  }

  getLineBinding(token: string) {
    return this.request<LineBindingSummary>(`/line/bindings/${encodeURIComponent(token)}`)
  }

  confirmLineBinding(token: string) {
    return this.request<{ message?: string }>(`/line/bindings/${encodeURIComponent(token)}/confirm`, {
      method: 'POST',
      body: {},
    })
  }

  logout() {
    return this.request<{ message?: string }>('/logout', { method: 'POST', body: {} })
  }

  logoutAll() {
    return createAccountSessionClient({
      baseUrl: this.baseUrl,
      fetcher: this.fetcher as typeof fetch,
    }).logoutAll()
  }

  getSocialLoginUrl(provider: string, authRequestId?: string) {
    const url = `${this.baseUrl}/oauth2/${encodeURIComponent(provider)}/login`
    return authRequestId ? `${url}?auth_request_id=${encodeURIComponent(authRequestId)}` : url
  }

  async getOAuthProviders() {
    const response = await this.request<{ providers?: string[] }>('/oauth-providers', { auth: false })
    return response.providers ?? []
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET'
    const headers: Record<string, string> = { accept: 'application/json' }

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    let requestBody: BodyInit | undefined
    if (options.body !== undefined) {
      requestBody = isFormData ? (options.body as FormData) : JSON.stringify(options.body)
    }

    if (options.body !== undefined && !isFormData) {
      headers['content-type'] = 'application/json'
    }

    if (this.needsCsrf(method)) {
      headers['x-csrf-token'] = await this.getCsrfToken()
    }

    if (options.auth !== false) {
      const token = this.getAccessToken?.()
      if (token) {
        headers.authorization = `Bearer ${token}`
      }
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: requestBody,
    })

    if (
      response.status === 401 &&
      options.auth !== false &&
      options.retry !== false &&
      path !== '/refresh'
    ) {
      const token = await this.refreshAccessToken()
      if (token) {
        return this.request<T>(path, { ...options, retry: false })
      }
    }

    return this.readResponse<T>(response)
  }

  private async getCsrfToken() {
    if (this.csrfToken) return this.csrfToken

    let request = csrfTokenRequests.get(this.baseUrl)
    if (!request) {
      request = this.fetcher(`${this.baseUrl}/csrf-token`, {
        credentials: 'include',
        headers: { accept: 'application/json' },
      }).then(async (response) => {
        const data = await this.readResponse<{ csrf_token?: string }>(response)
        if (!data.csrf_token) {
          throw new ApiError(response.status, 'CSRF token missing')
        }
        return data.csrf_token
      }).finally(() => {
        csrfTokenRequests.delete(this.baseUrl)
      })
      csrfTokenRequests.set(this.baseUrl, request)
    }

    this.csrfToken = await request
    return this.csrfToken
  }

  private needsCsrf(method: string) {
    return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
  }

  private async readResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    const data = text ? JSON.parse(text) : undefined

    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof data.message === 'string'
          ? data.message
          : `Request failed with status ${response.status}`
      const code =
        typeof data === 'object' &&
        data !== null &&
        'error_code' in data &&
        typeof data.error_code === 'string'
          ? data.error_code
          : undefined

      throw new ApiError(response.status, message, code, data)
    }

    return data as T
  }
}
