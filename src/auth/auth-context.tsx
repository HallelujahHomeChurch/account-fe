/* oxlint-disable react/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { AccountApi, type LoginRequest, type LoginResponse, type Profile } from '../lib/api'
import { MockAccountApi } from '../lib/mock-account-api'
import {
  buildOAuthRedirectUrl,
  readRuntimeConfig,
  type RuntimeConfig,
} from '../lib/redirects'

export type MfaChallenge = {
  type: 'setup_required' | 'verification_required'
  token: string
}

export type AuthApi = {
  login: (request: LoginRequest) => Promise<LoginResponse>
  me: () => Promise<Profile>
  refreshAccessToken: () => Promise<string | null>
  logout: () => Promise<unknown>
} & Partial<AccountApi>

type AuthContextValue = {
  accessToken: string | null
  profile: Profile | null
  mfaChallenge: MfaChallenge | null
  isBootstrapping: boolean
  api: AuthApi
  login: (request: LoginRequest) => Promise<LoginResponse>
  completeLogin: (response: LoginResponse) => Promise<LoginResponse>
  refreshProfile: () => Promise<Profile>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
  api?: AuthApi
  config?: RuntimeConfig
}

export function AuthProvider({ children, api: injectedApi, config = readRuntimeConfig() }: AuthProviderProps) {
  const tokenRef = useRef<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const writeAccessToken = useCallback((token: string | null) => {
    tokenRef.current = token
    setAccessToken(token)
  }, [])

  const api = useMemo<AuthApi>(() => {
    if (injectedApi) return injectedApi
    if (config.mockApi) return new MockAccountApi() as AuthApi

    return new AccountApi({
      baseUrl: config.accountApiBaseUrl,
      getAccessToken: () => tokenRef.current,
      setAccessToken: writeAccessToken,
    }) as AuthApi
  }, [config.accountApiBaseUrl, config.mockApi, injectedApi, writeAccessToken])

  const refreshProfile = useCallback(async () => {
    const nextProfile = await api.me()
    setProfile(nextProfile)
    return nextProfile
  }, [api])

  const completeLogin = useCallback(
    async (response: LoginResponse) => {
      if (response.mfa_type && response.mfa_token) {
        setMfaChallenge({ type: response.mfa_type, token: response.mfa_token })
        return response
      }

      setMfaChallenge(null)

      if (response.redirect_type === 'oauth' && response.redirect_uri && response.code && response.state) {
        window.location.assign(
          buildOAuthRedirectUrl(response.redirect_uri, response.code, response.state, config),
        )
        return response
      }

      if (response.access_token) {
        writeAccessToken(response.access_token)
        await refreshProfile()
      }

      return response
    },
    [config, refreshProfile, writeAccessToken],
  )

  const login = useCallback(
    async (request: LoginRequest) => {
      const response = await api.login(request)
      return completeLogin(response)
    },
    [api, completeLogin],
  )

  const logout = useCallback(async () => {
    await api.logout()
    writeAccessToken(null)
    setProfile(null)
    setMfaChallenge(null)
  }, [api, writeAccessToken])

  useEffect(() => {
    let alive = true

    async function bootstrap() {
      const token = await api.refreshAccessToken()
      if (!alive) return

      if (token) {
        writeAccessToken(token)
        await refreshProfile().catch(() => {
          writeAccessToken(null)
          setProfile(null)
        })
      }

      if (alive) setIsBootstrapping(false)
    }

    bootstrap().catch(() => {
      if (!alive) return
      writeAccessToken(null)
      setProfile(null)
      setIsBootstrapping(false)
    })

    return () => {
      alive = false
    }
  }, [api, refreshProfile, writeAccessToken])

  const value = useMemo(
    () => ({
      accessToken,
      profile,
      mfaChallenge,
      isBootstrapping,
      api,
      login,
      completeLogin,
      refreshProfile,
      logout,
    }),
    [accessToken, api, completeLogin, isBootstrapping, login, logout, mfaChallenge, profile, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
