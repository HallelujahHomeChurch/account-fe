import { readAnalyticsChoice } from '@hallelujahhomechurch/preferences'
export const pendingLoginAnalyticsKey = 'hhc_pending_login_analytics'
export function markLoginCompleted() {
  if (
    window.location.hostname !== 'account.alive.org.tw' ||
    !/^G-[A-Z0-9]{5,20}$/.test(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '') ||
    readAnalyticsChoice(document.cookie) !== 'granted'
  )
    return
  try {
    sessionStorage.setItem(pendingLoginAnalyticsKey, String(Date.now()))
  } catch {
    return
  }
  window.dispatchEvent(new Event('hhc:login-completed'))
}
export function markProfileSaved() {
  window.dispatchEvent(
    new CustomEvent('hhc:analytics-event', { detail: 'profile_saved' }),
  )
}
