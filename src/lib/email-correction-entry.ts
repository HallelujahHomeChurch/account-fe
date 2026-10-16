export const emailCorrectionVerificationPath = '/data-requests/verify-email'
let token: string | null = null
export function isEmailCorrectionVerificationPath(path = window.location.pathname) { return path === emailCorrectionVerificationPath }
export function captureEmailCorrectionEntry() {
  if (!isEmailCorrectionVerificationPath()) return false
  const values = new URLSearchParams(window.location.hash.slice(1)).getAll('token')
  token = values.length === 1 && values[0].length > 0 && values[0].length <= 512 ? values[0] : null
  history.replaceState(history.state, '', emailCorrectionVerificationPath)
  const meta = document.createElement('meta')
  meta.name = 'referrer'
  meta.content = 'no-referrer'
  document.head.append(meta)
  return true
}
export function readVerificationToken() { return token }
export function clearVerificationToken() { token = null }
