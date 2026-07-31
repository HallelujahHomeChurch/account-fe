/* oxlint-disable react/only-export-components */
import {
  type AccountSession,
} from '@hallelujahhomechurch/account-client'
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
  type: 'verification_required'
  token: string
}

export type AuthApi = {
  getSession?: () => Promise<AccountSession>
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
  bootstrapError: string | null
  logoutError: string | null
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
  restoreSession?: boolean
  navigateAfterLogout?: (url: string) => void
}

function defaultNavigateAfterLogout(url: string) {
  window.location.replace(url)
}

export function AuthProvider({
  children,
  api: injectedApi,
  config = readRuntimeConfig(),
  restoreSession = true,
  navigateAfterLogout = defaultNavigateAfterLogout,
}: AuthProviderProps) {
  const tokenRef = useRef<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const bootstrapRef = useRef<{
    api: AuthApi
    promise: Promise<{ token: string | null; profile: Profile | null }>
  } | null>(null)

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
    setLogoutError(null)
    try {
      await (api.logoutAll ? api.logoutAll() : api.logout())
      writeAccessToken(null)
      setProfile(null)
      setMfaChallenge(null)
      navigateAfterLogout('/login?signed_out=1')
    } catch {
      setLogoutError('Unable to sign out. Try again.')
    }
  }, [api, navigateAfterLogout, writeAccessToken])

  useEffect(() => {
    let alive = true

    if (!restoreSession) {
      setIsBootstrapping(false)
      return () => {
        alive = false
      }
    }

    if (!bootstrapRef.current || bootstrapRef.current.api !== api) {
      bootstrapRef.current = {
        api,
        promise: (async () => {
          const session = api.getSession
            ? await api.getSession()
            : { authenticated: true as const, user: undefined }
          if (!session.authenticated) return { token: null, profile: null }

          const token = await api.refreshAccessToken()
          if (!token) return { token: null, profile: null }
          return { token, profile: await api.me() }
        })(),
      }
    }

    setBootstrapError(null)
    bootstrapRef.current.promise
      .then((result) => {
        if (!alive) return
        writeAccessToken(result.token)
        setProfile(result.profile)
      })
      .catch(() => {
        if (!alive) return
        writeAccessToken(null)
        setProfile(null)
        setBootstrapError('Unable to check your sign-in status. Try again.')
      })
      .finally(() => {
        if (alive) setIsBootstrapping(false)
      })

    return () => {
      alive = false
    }
  }, [api, refreshProfile, restoreSession, writeAccessToken])

  const value = useMemo(
    () => ({
      accessToken,
      profile,
      mfaChallenge,
      isBootstrapping,
      bootstrapError,
      logoutError,
      api,
      login,
      completeLogin,
      refreshProfile,
      logout,
    }),
    [accessToken, api, bootstrapError, completeLogin, isBootstrapping, login, logout, logoutError, mfaChallenge, profile, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function RoutedAuthProvider({ children, api, config }: AuthProviderProps) {
  return (
    <AuthProvider api={api} config={config}>
      {children}
    </AuthProvider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
