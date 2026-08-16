import {
  buildAuthorizeUrl,
  clearOAuthTransaction,
  readOAuthTransaction,
  saveOAuthTransaction,
  type OAuthClientConfig,
  type OAuthTransaction,
} from '@hallelujahhomechurch/account-client'

export type RuntimeConfig = {
  accountApiBaseUrl: string
  accountAuthorizeBaseUrl: string
  accountClientId: string
  redirectUri: string
  oauthScope: string
  mockApi: boolean
  allowedRedirectOrigins: string[]
  allowedRedirectSchemes: string[]
  publicSiteUrl: string
  turnstileSiteKey?: string
}

type EnvLike = Record<string, string | boolean | undefined>

const accountTransactionKey = 'hhc_account_oauth_transaction'
const defaultAllowedOrigins = [
  'https://admin.alive.org.tw',
  'https://admin-test.alive.org.tw',
  'https://www.alive.org.tw',
  'https://www-test.alive.org.tw',
  'http://localhost:5173',
  'http://localhost:3000',
]

function splitCsv(value: string | boolean | undefined, fallback: string[]) {
  if (typeof value !== 'string' || value.trim() === '') return fallback
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function stringEnv(value: string | boolean | undefined, fallback: string) {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}

export function readRuntimeConfig(
  env: EnvLike = import.meta.env,
  currentUrl: URL = new URL(window.location.href),
): RuntimeConfig {
  const accountApiBaseUrl = stringEnv(env.VITE_ACCOUNT_API_BASE_URL, '/api/account/v1')
  return {
    accountApiBaseUrl,
    accountAuthorizeBaseUrl: stringEnv(env.VITE_ACCOUNT_AUTHORIZE_BASE_URL, accountApiBaseUrl),
    accountClientId: stringEnv(env.VITE_ACCOUNT_CLIENT_ID, 'account-console'),
    redirectUri: stringEnv(env.VITE_ACCOUNT_REDIRECT_URI, `${currentUrl.origin}/oauth/callback`),
    oauthScope: stringEnv(env.VITE_ACCOUNT_OAUTH_SCOPE, 'openid profile email'),
    mockApi: env.VITE_ACCOUNT_API_MOCK === 'true' || env.VITE_ACCOUNT_API_MOCK === true,
    allowedRedirectOrigins: splitCsv(env.VITE_ALLOWED_REDIRECT_ORIGINS, defaultAllowedOrigins),
    allowedRedirectSchemes: splitCsv(env.VITE_ALLOWED_REDIRECT_SCHEMES, ['librepresenter']),
    publicSiteUrl: stringEnv(env.VITE_PUBLIC_SITE_URL, 'https://www.alive.org.tw').replace(/\/$/, ''),
    turnstileSiteKey: stringEnv(env.VITE_TURNSTILE_SITE_KEY, ''),
  }
}

export function accountOAuthConfig(config: RuntimeConfig): OAuthClientConfig {
  return {
    authorizeBaseUrl: config.accountAuthorizeBaseUrl,
    clientId: config.accountClientId,
    redirectUri: config.redirectUri,
    scope: config.oauthScope,
  }
}

export function buildAccountAuthorizeUrl(config: RuntimeConfig, transaction: OAuthTransaction) {
  return buildAuthorizeUrl({
    ...accountOAuthConfig(config),
    authorizeBaseUrl: new URL(config.accountAuthorizeBaseUrl, window.location.origin).toString(),
  }, transaction)
}

export function saveAccountOAuthTransaction(
  transaction: OAuthTransaction,
  storage: Storage = sessionStorage,
) {
  saveOAuthTransaction(transaction, { storage, storageKey: accountTransactionKey })
}

export function readAccountOAuthTransaction(storage: Storage = sessionStorage) {
  return readOAuthTransaction({ storage, storageKey: accountTransactionKey })
}

export function clearAccountOAuthTransaction(storage: Storage = sessionStorage) {
  clearOAuthTransaction({ storage, storageKey: accountTransactionKey })
}

export function isAllowedRedirect(redirectUri: string, config: RuntimeConfig) {
  let url: URL

  try {
    url = new URL(redirectUri)
  } catch {
    return false
  }

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return config.allowedRedirectOrigins.includes(url.origin)
  }

  return url.protocol === 'librepresenter:'
    && config.allowedRedirectSchemes.includes('librepresenter')
    && url.host === 'auth'
    && url.pathname === '/account'
    && url.username === ''
    && url.password === ''
    && !url.searchParams.has('code')
    && !url.searchParams.has('state')
    && url.hash === ''
}

export function buildOAuthRedirectUrl(
  redirectUri: string,
  code: string,
  state: string,
  config: RuntimeConfig,
) {
  if (!isAllowedRedirect(redirectUri, config)) {
    throw new Error('Blocked unsafe redirect URI')
  }

  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  url.searchParams.set('state', state)
  return url.toString()
}
