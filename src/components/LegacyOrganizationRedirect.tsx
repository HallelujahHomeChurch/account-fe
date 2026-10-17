import {useEffect} from 'react'
import {Navigate, useLocation} from 'react-router-dom'
import {useLocale} from '../i18n/locale-context'
import {readRuntimeConfig} from '../lib/redirects'
import {organizationRedirectUrl, replaceOrganizationLocation} from '../lib/organization-redirect'

export function LegacyOrganizationRedirect() {
  const {pathname} = useLocation()
  const {locale} = useLocale()
  const destination = organizationRedirectUrl(pathname, locale, readRuntimeConfig().publicSiteUrl, window.location.hostname)
  useEffect(() => { if (destination) replaceOrganizationLocation(destination) }, [destination])
  return destination ? null : <Navigate replace to="/profile" />
}
