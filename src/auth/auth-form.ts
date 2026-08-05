import { ApiError } from '../lib/api'

export function isStrongPassword(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
}

export function validateEmail(value: string, message: string) {
  if (!value) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : message
}

export function authErrorMessage(caught: unknown, fallback: string, messages: Record<string, string> = {}) {
  if (caught instanceof ApiError && caught.code) return messages[caught.code] ?? fallback
  return fallback
}
