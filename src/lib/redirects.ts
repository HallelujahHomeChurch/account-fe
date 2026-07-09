export type RuntimeConfig = {
  accountApiBaseUrl: string
  mockApi: boolean
  allowedRedirectOrigins: string[]
  allowedRedirectSchemes: string[]
}

type EnvLike = Record<string, string | boolean | undefined>

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

export function readRuntimeConfig(env: EnvLike = import.meta.env): RuntimeConfig {
  return {
    accountApiBaseUrl:
      typeof env.VITE_ACCOUNT_API_BASE_URL === 'string' && env.VITE_ACCOUNT_API_BASE_URL
        ? env.VITE_ACCOUNT_API_BASE_URL
        : '/api/account/v1',
    mockApi: env.VITE_ACCOUNT_API_MOCK === 'true' || env.VITE_ACCOUNT_API_MOCK === true,
    allowedRedirectOrigins: splitCsv(env.VITE_ALLOWED_REDIRECT_ORIGINS, defaultAllowedOrigins),
    allowedRedirectSchemes: splitCsv(env.VITE_ALLOWED_REDIRECT_SCHEMES, ['hhc']),
  }
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

  return config.allowedRedirectSchemes.includes(url.protocol.replace(':', ''))
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
