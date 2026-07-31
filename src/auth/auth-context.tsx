/* oxlint-disable react/only-export-components */
import {
  createOAuthTransaction,
  currentReturnTo,
  validateOAuthState,
  type AccountSession,
  type OAuthTokenResponse,
  type OAuthTransaction,
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
import { useLocation } from 'react-router-dom'
import { AccountApi, type LoginRequest, type LoginResponse, type Profile } from '../lib/api'
import { MockAccountApi } from '../lib/mock-account-api'
import {
  accountOAuthConfig,
  buildAccountAuthorizeUrl,
  buildOAuthRedirectUrl,
  clearAccountOAuthTransaction,
  readAccountOAuthTransaction,
  readRuntimeConfig,
  saveAccountOAuthTransaction,
  type RuntimeConfig,
} from '../lib/redirects'
import { isAuthRoutePath } from './auth-routes'

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
  exchangeCode?: (
    config: ReturnType<typeof accountOAuthConfig>,
    transaction: OAuthTransaction,
    code: string,
  ) => Promise<OAuthTokenResponse>
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
  completeOAuthCallback: (code: string, state: string) => Promise<string>
  startAuthorization: (returnTo: string) => Promise<void>
  refreshProfile: () => Promise<Profile>
  logout: () => Promise<void>
  clearLocalSession: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
  api?: AuthApi
  config?: RuntimeConfig
  restoreSession?: boolean
  navigateAfterLogout?: (url: string) => void
  navigateExternal?: (url: string) => void
  route?: Pick<Location, 'pathname' | 'search' | 'hash'>
  authorizeMissingSession?: boolean
}

function defaultNavigateAfterLogout(url: string) {
  window.location.replace(url)
}

function defaultNavigateExternal(url: string) {
  window.location.assign(url)
}

export function AuthProvider({
  children,
  api: injectedApi,
  config = readRuntimeConfig(),
  restoreSession = true,
  navigateAfterLogout = defaultNavigateAfterLogout,
  navigateExternal = defaultNavigateExternal,
  route = window.location,
  authorizeMissingSession = false,
}: AuthProviderProps) {
  const tokenRef = useRef<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const authorizationRef = useRef<Promise<void> | null>(null)
  const authRevisionRef = useRef(0)
  const bootstrapRef = useRef<{
    api: AuthApi
    revision: number
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

  const beginAuthorization = useCallback((returnTo: string) => {
    if (authorizationRef.current) return authorizationRef.current
    const request = (async () => {
      const transaction = await createOAuthTransaction(returnTo)
      saveAccountOAuthTransaction(transaction)
      navigateExternal(buildAccountAuthorizeUrl(config, transaction).toString())
    })()
    authorizationRef.current = request
    void request.catch(() => {
      authorizationRef.current = null
    })
    return request
  }, [config, navigateExternal])

  const completeOAuthCallback = useCallback(async (code: string, state: string) => {
    const transaction = readAccountOAuthTransaction()
    if (!validateOAuthState(transaction, state)) {
      throw new Error('OAuth state did not match this browser session.')
    }
    if (!api.exchangeCode) throw new Error('OAuth code exchange is unavailable.')

    authRevisionRef.current += 1
    const response = await api.exchangeCode(accountOAuthConfig(config), transaction, code)
    writeAccessToken(response.access_token)
    clearAccountOAuthTransaction()
    await refreshProfile()
    return transaction.returnTo
  }, [api, config, refreshProfile, writeAccessToken])

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
      authRevisionRef.current += 1
      const response = await api.login(request)
      return completeLogin(response)
    },
    [api, completeLogin],
  )

  const logout = useCallback(async () => {
    authRevisionRef.current += 1
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

  const clearLocalSession = useCallback(() => {
    authRevisionRef.current += 1
    writeAccessToken(null)
    setProfile(null)
    setMfaChallenge(null)
    navigateAfterLogout('/login?signed_out=1')
  }, [navigateAfterLogout, writeAccessToken])

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
        revision: authRevisionRef.current,
        promise: (async () => {
          const shouldAuthorize = authorizeMissingSession
            && !config.mockApi
            && !isAuthRoutePath(route.pathname)
          const session = api.getSession
            ? await api.getSession()
            : { authenticated: true as const, user: undefined }
          if (!session.authenticated) {
            if (!shouldAuthorize) return { token: null, profile: null }
            await beginAuthorization(currentReturnTo(route))
            return { token: null, profile: null }
          }

          const token = await api.refreshAccessToken()
          if (!token) {
            if (shouldAuthorize) await beginAuthorization(currentReturnTo(route))
            return { token: null, profile: null }
          }
          return { token, profile: await api.me() }
        })(),
      }
    }

    setBootstrapError(null)
    bootstrapRef.current.promise
      .then((result) => {
        if (!alive || bootstrapRef.current?.revision !== authRevisionRef.current) return
        writeAccessToken(result.token)
        setProfile(result.profile)
      })
      .catch(() => {
        if (!alive || bootstrapRef.current?.revision !== authRevisionRef.current) return
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
  }, [api, authorizeMissingSession, beginAuthorization, config.mockApi, restoreSession, route, writeAccessToken])

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
      completeOAuthCallback,
      startAuthorization: beginAuthorization,
      refreshProfile,
      logout,
      clearLocalSession,
    }),
    [accessToken, api, beginAuthorization, bootstrapError, clearLocalSession, completeLogin, completeOAuthCallback, isBootstrapping, login, logout, logoutError, mfaChallenge, profile, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function RoutedAuthProvider({ children, api, config, navigateExternal }: AuthProviderProps) {
  const route = useLocation()
  return (
    <AuthProvider
      api={api}
      config={config}
      route={route}
      authorizeMissingSession
      navigateExternal={navigateExternal}
    >
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
