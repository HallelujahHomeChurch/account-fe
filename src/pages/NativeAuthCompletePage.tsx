import { Button } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { LanguageSelector } from '../components/LanguageSelector'
import { useLocale } from '../i18n/locale-context'
import {
  openNativeAuthCallback,
  readNativeAuthCallback,
  readRuntimeConfig,
} from '../lib/redirects'

export function NativeAuthCompletePage() {
  const { messages: t } = useLocale()
  const [callback] = useState(() => readNativeAuthCallback(window.location.hash, readRuntimeConfig()))

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname)
    if (callback) openNativeAuthCallback(callback)
  }, [callback])

  return (
    <section className="login-shell" aria-labelledby="native-auth-title">
      <div className="login-card">
        <div className="login-copy">
          <img className="login-brand-mark" src="/assets/brand/logo.png" alt="" />
          <h1 id="native-auth-title">
            {callback ? t.nativeAuth.title : t.nativeAuth.invalidTitle}
          </h1>
          <p>{callback ? t.nativeAuth.description : t.nativeAuth.invalidDescription}</p>
        </div>
        <div className="login-form-panel auth-result-state">
          {callback ? (
            <Button onPress={() => openNativeAuthCallback(callback)}>{t.nativeAuth.openApp}</Button>
          ) : (
            <Link className="muted-link" to="/login">{t.nativeAuth.backToLogin}</Link>
          )}
        </div>
      </div>
      <div className="login-footer"><LanguageSelector /></div>
    </section>
  )
}
