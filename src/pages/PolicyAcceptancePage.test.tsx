import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

import { AuthProvider, type AuthApi } from '../auth/auth-context'
import { LocaleProvider } from '../i18n/locale-context'
import { ApiError } from '../lib/api'
import { PolicyAcceptancePage } from './PolicyAcceptancePage'
import { hasPostLoginReturnTo, savePostLoginReturnTo } from '../auth/auth-routes'

it('keeps the resume token in memory and rotates stale versions', async () => {
  document.cookie = 'hhc_locale=en; Path=/'
  window.history.replaceState(null, '', '/policy/acceptance#token=old-token')
  const confirm = vi.fn()
    .mockRejectedValueOnce(new ApiError(409, 'changed', 'ACC_POLICY_VERSION_CHANGED', {
      policy_token: 'new-token', terms_version: 'terms-v2', privacy_notice_version: 'privacy-v2',
    }))
    .mockResolvedValueOnce({ access_token: 'access-token', redirect_type: 'profile' })
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}), confirmPolicyAcceptance: confirm,
    getAuthCapabilities: async () => ({ providers: [], registrationEnabled: false, policy: { enforced: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' } }),
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><PolicyAcceptancePage /></AuthProvider></LocaleProvider></MemoryRouter>)

  expect(window.location.hash).toBe('')
  const checkbox = await screen.findByRole('checkbox', { name: /I agree to the Terms of Use/i })
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(checkbox).not.toBeChecked()
  await userEvent.click(checkbox)
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

  expect(confirm).toHaveBeenNthCalledWith(1, 'old-token', expect.objectContaining({ terms_version: 'terms-v1' }))
  expect(confirm).toHaveBeenNthCalledWith(2, 'new-token', expect.objectContaining({ terms_version: 'terms-v2' }))
  expect(Object.values(localStorage).join('')).not.toMatch(/old-token|new-token|access-token|user@example\.com/)
  expect(JSON.parse(localStorage.getItem('hhc:navigation:account-web')!).sources.account.ids).toEqual(['shell'])
  expect(sessionStorage.length).toBe(0)
})

it('offers restart when the fragment token is missing', async () => {
  sessionStorage.clear()
  savePostLoginReturnTo('/data-requests')
  window.history.replaceState(null, '', '/policy/acceptance')
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}),
  }
  render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><PolicyAcceptancePage /></AuthProvider></LocaleProvider></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Start sign-in again' })).toHaveAttribute('href', '/login')
  expect(hasPostLoginReturnTo()).toBe(false)
})

it('consumes a social callback continuation after policy acceptance', async () => {
  sessionStorage.clear()
  savePostLoginReturnTo('/data-requests')
  window.history.replaceState(null, '', '/policy/acceptance#token=policy-token')
  const api: AuthApi = {
    login: async () => ({}), me: async () => ({ id: 'u1', email: 'user@example.com' }),
    refreshAccessToken: async () => null, logout: async () => ({}),
    confirmPolicyAcceptance: async () => ({ access_token: 'access-token', redirect_type: 'profile' }),
    getAuthCapabilities: async () => ({ providers: [], registrationEnabled: false, policy: { enforced: true, terms_version: 'terms-v1', privacy_notice_version: 'privacy-v1' } }),
  }
  render(<MemoryRouter initialEntries={['/policy/acceptance']}><LocaleProvider><AuthProvider api={api} restoreSession={false}><Routes>
    <Route path="/policy/acceptance" element={<PolicyAcceptancePage />} />
    <Route path="/data-requests" element={<h1>Data requests restored</h1>} />
  </Routes></AuthProvider></LocaleProvider></MemoryRouter>)
  await userEvent.click(await screen.findByRole('checkbox', { name: /I agree to the Terms of Use/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(await screen.findByRole('heading', { name: 'Data requests restored' })).toBeInTheDocument()
  expect(sessionStorage.getItem('hhc_account_post_login_return_to')).toBeNull()
})

it('requires the reviewed published snapshot before allowing confirmation', async () => {
 document.cookie='hhc_locale=en; Path=/'
 window.history.replaceState(null,'','/policy/acceptance#token=review-token')
 const legalDocument={schemaVersion:1 as const,template:'legal.v1' as const,data:{heroTitle:'Published document',updatedAtLabel:'Updated',updatedAt:'2026-10-01',intro:'Published introduction',sections:[{title:'Section',body:['Published body']}]}}
 const snapshot={snapshotId:'018f0c1f-18d0-7e81-9f6f-69c456db7001',manifest:{scope:'common' as const,locale:'en' as const,termsVersion:'terms-v1',privacyNoticeVersion:'privacy-v1',termsSHA256:'a'.repeat(64),privacySHA256:'b'.repeat(64)},documents:{terms:legalDocument,privacy:legalDocument}}
 const confirm=vi.fn().mockResolvedValue({})
 const api:AuthApi={login:async()=>({}),me:async()=>({id:'u1',email:'user@example.com'}),refreshAccessToken:async()=>null,logout:async()=>({}),confirmPolicyAcceptance:confirm,getCommonLegalSnapshot:async()=>snapshot,getAuthCapabilities:async()=>({providers:[],registrationEnabled:false,policy:{enforced:true,snapshot_enforced:true,terms_version:'terms-v1',privacy_notice_version:'privacy-v1'}})}
 render(<MemoryRouter><LocaleProvider><AuthProvider api={api} restoreSession={false}><PolicyAcceptancePage/></AuthProvider></LocaleProvider></MemoryRouter>)
 await screen.findAllByText('Published body')
 const checkbox=await screen.findByRole('checkbox')
 await userEvent.click(checkbox)
 await userEvent.click(screen.getByRole('button',{name:'Continue'}))
 expect(confirm).toHaveBeenCalledWith('review-token',expect.objectContaining({snapshot_id:snapshot.snapshotId,locale:'en'}))
})
