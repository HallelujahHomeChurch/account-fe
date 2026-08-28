/* oxlint-disable react/only-export-components */
import {
  createOAuthTransaction,
  currentReturnTo,
  resolveAccountAuth,
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
import { useLocale } from '../i18n/locale-context'
import { AccountApi, ApiError, type LoginRequest, type LoginResponse, type Profile } from '../lib/api'
import { MockAccountApi } from '../lib/mock-account-api'
import {
  accountOAuthConfig,
  buildAccountAuthorizeUrl,
  buildNativeAuthCompletionPath,
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
  issueAccessToken?: () => Promise<string>
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
  status: AuthStatus
  accessToken: string | null
  profile: Profile | null
  mfaChallenge: MfaChallenge | null
  isBootstrapping: boolean
  bootstrapError: string | null
  logoutError: string | null
  api: AuthApi
  login: (request: LoginRequest) => Promise<LoginResponse>
  completeLogin: (response: LoginResponse) => Promise<LoginResponse>
  verifyMfa: (code: string) => Promise<LoginResponse>
  completeOAuthCallback: (code: string, state: string) => Promise<string>
  startAuthorization: (returnTo: string) => Promise<void>
  refreshProfile: () => Promise<Profile>
  logout: () => Promise<void>
  retrySession: () => Promise<void>
  clearLocalSession: (redirectTo?: string) => void
  navigateExternal: (url: string) => void
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'mfa' | 'unavailable'

type AuthState = {
  status: AuthStatus
  accessToken: string | null
  profile: Profile | null
  mfaChallenge: MfaChallenge | null
  bootstrapError: string | null
  logoutError: string | null
}

const emptyAuthState: AuthState = {
  status: 'loading',
  accessToken: null,
  profile: null,
  mfaChallenge: null,
  bootstrapError: null,
  logoutError: null,
}

const AuthContext = createContext<AuthContextValue | null>(null)

export type AuthErrorLabels = {
  sessionCheckFailed: string
  signOutFailed: string
}

const defaultAuthErrorLabels: AuthErrorLabels = {
  sessionCheckFailed: 'Unable to check your sign-in status. Try again.',
  signOutFailed: 'Unable to sign out. Try again.',
}

type AuthProviderProps = {
  children: ReactNode
  api?: AuthApi
  config?: RuntimeConfig
  restoreSession?: boolean
  navigateAfterLogout?: (url: string) => void
  navigateExternal?: (url: string) => void
  route?: Pick<Location, 'pathname' | 'search' | 'hash'>
  authorizeMissingSession?: boolean
  errorLabels?: AuthErrorLabels
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
  config: suppliedConfig,
  restoreSession = true,
  navigateAfterLogout = defaultNavigateAfterLogout,
  navigateExternal = defaultNavigateExternal,
  route = window.location,
  authorizeMissingSession = false,
  errorLabels = defaultAuthErrorLabels,
}: AuthProviderProps) {
  const [config] = useState(() => suppliedConfig ?? readRuntimeConfig())
  const tokenRef = useRef<string | null>(null)
  const [state, setState] = useState<AuthState>(emptyAuthState)
  const stateRef = useRef<AuthState>(emptyAuthState)
  const errorLabelsRef = useRef(errorLabels)
  errorLabelsRef.current = errorLabels
  const authorizationRef = useRef<Promise<void> | null>(null)
  const authRevisionRef = useRef(0)
  const initialRouteRef = useRef({
    pathname: route.pathname,
    search: route.search,
    hash: route.hash,
  })
  const revalidationRef = useRef<Promise<void> | null>(null)
  const bootstrapRef = useRef<{
    api: AuthApi
    revision: number
    promise: Promise<AuthState>
  } | null>(null)

  const setTokenRef = useCallback((token: string | null) => {
    tokenRef.current = token
  }, [])

  const commitState = useCallback((next: AuthState) => {
    tokenRef.current = next.accessToken
    stateRef.current = next
    setState(next)
  }, [])

  const patchState = useCallback((patch: Partial<AuthState>) => {
    commitState({ ...stateRef.current, ...patch })
  }, [commitState])

  const api = useMemo<AuthApi>(() => {
    if (injectedApi) return injectedApi
    if (config.mockApi) return new MockAccountApi() as AuthApi

    return new AccountApi({
      baseUrl: config.accountApiBaseUrl,
      getAccessToken: () => tokenRef.current,
      setAccessToken: setTokenRef,
    }) as AuthApi
  }, [config.accountApiBaseUrl, config.mockApi, injectedApi, setTokenRef])

  const refreshProfile = useCallback(async () => {
    const revision = authRevisionRef.current
    const nextProfile = await api.me()
    if (revision === authRevisionRef.current) {
      patchState({
        status: 'authenticated',
        profile: nextProfile,
        bootstrapError: null,
      })
    }
    return nextProfile
  }, [api, patchState])

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
    const revision = authRevisionRef.current
    const response = await api.exchangeCode(accountOAuthConfig(config), transaction, code)
    const previousToken = tokenRef.current
    setTokenRef(response.access_token)
    let nextProfile: Profile
    try {
      nextProfile = await api.me()
    } catch (error) {
      if (revision === authRevisionRef.current) setTokenRef(previousToken)
      throw error
    }
    if (revision !== authRevisionRef.current) {
      setTokenRef(stateRef.current.accessToken)
      return transaction.returnTo
    }
    commitState({
      status: 'authenticated',
      accessToken: response.access_token,
      profile: nextProfile,
      mfaChallenge: null,
      bootstrapError: null,
      logoutError: null,
    })
    clearAccountOAuthTransaction()
    return transaction.returnTo
  }, [api, commitState, config, setTokenRef])

  const completeLogin = useCallback(
    async (response: LoginResponse) => {
      if (response.mfa_type && response.mfa_token) {
        commitState({
          status: 'mfa',
          accessToken: null,
          profile: null,
          mfaChallenge: { type: response.mfa_type, token: response.mfa_token },
          bootstrapError: null,
          logoutError: null,
        })
        return response
      }

      if (response.redirect_type === 'oauth' && response.redirect_uri && response.code && response.state) {
        const callback = buildOAuthRedirectUrl(
          response.redirect_uri,
          response.code,
          response.state,
          config,
        )
        window.location.assign(callback.startsWith('librepresenter:')
          ? buildNativeAuthCompletionPath(callback, config)
          : callback)
        return response
      }

      if (response.access_token) {
        const revision = authRevisionRef.current
        const previousToken = tokenRef.current
        setTokenRef(response.access_token)
        let nextProfile: Profile
        try {
          nextProfile = await api.me()
        } catch (error) {
          if (revision === authRevisionRef.current) setTokenRef(previousToken)
          throw error
        }
        if (revision === authRevisionRef.current) {
          commitState({
            status: 'authenticated',
            accessToken: response.access_token,
            profile: nextProfile,
            mfaChallenge: null,
            bootstrapError: null,
            logoutError: null,
          })
        } else {
          setTokenRef(stateRef.current.accessToken)
        }
      }

      return response
    },
    [api, commitState, config, setTokenRef],
  )

  const login = useCallback(
    async (request: LoginRequest) => {
      authRevisionRef.current += 1
      const response = await api.login(request)
      return completeLogin(response)
    },
    [api, completeLogin],
  )

  const verifyMfa = useCallback(async (code: string) => {
    const challenge = stateRef.current.mfaChallenge
    if (!challenge || !api.verifyMfa) throw new Error('MFA verification is unavailable.')
    authRevisionRef.current += 1
    try {
      const response = await api.verifyMfa(challenge.token, code)
      return completeLogin(response)
    } catch (error) {
      if (error instanceof ApiError && ['ACC_MFA_TOKEN_INVALID', 'ACC_MFA_CODE_EXPIRED'].includes(error.code ?? '')) {
        commitState({ ...emptyAuthState, status: 'anonymous' })
      }
      throw error
    }
  }, [api, commitState, completeLogin])

  const logout = useCallback(async () => {
    authRevisionRef.current += 1
    patchState({ logoutError: null })
    try {
      await (api.logoutAll ? api.logoutAll() : api.logout())
      commitState({ ...emptyAuthState, status: 'anonymous' })
      navigateAfterLogout('/login?signed_out=1')
    } catch {
      if (api.getSession) {
        const session = await resolveAccountAuth({ getSession: api.getSession })
        if (session.status === 'anonymous') {
          commitState({ ...emptyAuthState, status: 'anonymous' })
          navigateAfterLogout('/login?signed_out=1')
          return
        }
      }
      patchState({ logoutError: errorLabelsRef.current.signOutFailed })
    }
  }, [api, commitState, navigateAfterLogout, patchState])

  const clearLocalSession = useCallback((redirectTo = '/login?signed_out=1') => {
    authRevisionRef.current += 1
    commitState({ ...emptyAuthState, status: 'anonymous' })
    navigateAfterLogout(redirectTo)
  }, [commitState, navigateAfterLogout])

  const resolveState = useCallback(async (revision: number): Promise<AuthState> => {
    const session = api.getSession
      ? await resolveAccountAuth({ getSession: api.getSession })
      : { status: 'authenticated' as const }
    if (session.status === 'anonymous') return { ...emptyAuthState, status: 'anonymous' }
    if (session.status === 'unavailable') {
      return {
        ...stateRef.current,
        status: 'unavailable',
        bootstrapError: errorLabelsRef.current.sessionCheckFailed,
      }
    }

    try {
      const token = api.issueAccessToken
        ? await api.issueAccessToken()
        : await api.refreshAccessToken()
      if (!token) return { ...emptyAuthState, status: 'anonymous' }
      if (revision !== authRevisionRef.current) {
        setTokenRef(stateRef.current.accessToken)
        return stateRef.current
      }
      setTokenRef(token)
      const nextProfile = await api.me()
      if (revision !== authRevisionRef.current) {
        setTokenRef(stateRef.current.accessToken)
        return stateRef.current
      }
      return {
        status: 'authenticated',
        accessToken: token,
        profile: nextProfile,
        mfaChallenge: null,
        bootstrapError: null,
        logoutError: null,
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 409)) {
        return { ...emptyAuthState, status: 'anonymous' }
      }
      return {
        ...stateRef.current,
        status: 'unavailable',
        bootstrapError: errorLabelsRef.current.sessionCheckFailed,
      }
    }
  }, [api, setTokenRef])

  const revalidateSession = useCallback(() => {
    if (revalidationRef.current) return revalidationRef.current
    const revision = authRevisionRef.current
    const resolveRevalidation = async () => {
      if (stateRef.current.status === 'loading' && bootstrapRef.current) {
        return bootstrapRef.current.promise
      }
      if (stateRef.current.status !== 'authenticated' || !tokenRef.current) {
        return resolveState(revision)
      }
      try {
        const profile = await api.me()
        return { ...stateRef.current, accessToken: tokenRef.current, profile, bootstrapError: null }
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          return { ...stateRef.current, status: 'unavailable' as const, bootstrapError: errorLabelsRef.current.sessionCheckFailed }
        }
      }
      try {
        const previousToken = tokenRef.current
        const token = await api.refreshAccessToken()
        if (!token) return { ...emptyAuthState, status: 'anonymous' as const }
        if (revision !== authRevisionRef.current) return stateRef.current
        setTokenRef(token)
        let profile: Profile
        try {
          profile = await api.me()
        } catch (error) {
          if (revision === authRevisionRef.current) setTokenRef(previousToken)
          throw error
        }
        if (revision !== authRevisionRef.current) {
          setTokenRef(stateRef.current.accessToken)
          return stateRef.current
        }
        return { ...stateRef.current, status: 'authenticated' as const, accessToken: token, profile, bootstrapError: null }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 409)) {
          return { ...emptyAuthState, status: 'anonymous' as const }
        }
        return { ...stateRef.current, status: 'unavailable' as const, bootstrapError: errorLabelsRef.current.sessionCheckFailed }
      }
    }
    const request = resolveRevalidation()
      .then(async (next) => {
        if (revision !== authRevisionRef.current) return
        if (
          next.status === 'anonymous'
          && authorizeMissingSession
          && !config.mockApi
          && !isAuthRoutePath(window.location.pathname)
        ) {
          await beginAuthorization(currentReturnTo(window.location))
          return
        }
        commitState(next)
      })
      .finally(() => {
        revalidationRef.current = null
      })
    revalidationRef.current = request
    return request
  }, [api, authorizeMissingSession, beginAuthorization, commitState, config.mockApi, resolveState, setTokenRef])

  useEffect(() => {
    let alive = true

    if (!restoreSession) {
      if (stateRef.current.status === 'loading') {
        commitState({ ...emptyAuthState, status: 'anonymous' })
      }
      return () => {
        alive = false
      }
    }

    if (!bootstrapRef.current || bootstrapRef.current.api !== api) {
      bootstrapRef.current = {
        api,
        revision: authRevisionRef.current,
        promise: resolveState(authRevisionRef.current),
      }
    }

    bootstrapRef.current.promise
      .then(async (result) => {
        if (!alive || bootstrapRef.current?.revision !== authRevisionRef.current) return
        const shouldAuthorize = authorizeMissingSession
          && !config.mockApi
          && !isAuthRoutePath(initialRouteRef.current.pathname)
        if (result.status === 'anonymous' && shouldAuthorize) {
          await beginAuthorization(currentReturnTo(initialRouteRef.current))
          return
        }
        if (alive && bootstrapRef.current?.revision === authRevisionRef.current) commitState(result)
      })

    return () => {
      alive = false
    }
  }, [api, authorizeMissingSession, beginAuthorization, commitState, config.mockApi, resolveState, restoreSession])

  useEffect(() => {
    if (!restoreSession) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void revalidateSession(), 150)
    }
    const onFocus = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) schedule()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [restoreSession, revalidateSession])

  const value = useMemo(
    () => ({
      ...state,
      isBootstrapping: state.status === 'loading',
      api,
      login,
      completeLogin,
      verifyMfa,
      completeOAuthCallback,
      startAuthorization: beginAuthorization,
      refreshProfile,
      logout,
      retrySession: revalidateSession,
      clearLocalSession,
      navigateExternal,
    }),
    [api, beginAuthorization, clearLocalSession, completeLogin, completeOAuthCallback, login, logout, navigateExternal, refreshProfile, revalidateSession, state, verifyMfa],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function RoutedAuthProvider({ children, api, config, errorLabels, navigateExternal, restoreSession }: AuthProviderProps) {
  const route = useLocation()
  const { messages } = useLocale()
  return (
    <AuthProvider
      api={api}
      config={config}
      errorLabels={errorLabels ?? messages.authErrors}
      route={route}
      restoreSession={restoreSession ?? route.pathname !== '/oauth/callback'}
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
