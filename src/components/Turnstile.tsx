import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n/locale-context'
import { initObservability } from '../observability'

declare global {
  interface Window {
    turnstile?: {
      render: (target: HTMLElement, options: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback': () => void
        'error-callback': (code: string) => boolean
        retry: 'never'
      }) => string
      remove: (widgetId: string) => void
    }
  }
}

const scriptId = 'cloudflare-turnstile-script'

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const targetRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { messages } = useLocale()

  useEffect(() => {
    if (!siteKey || !targetRef.current) return
    let active = true
    let widgetId = ''
    const fail = (code: string) => {
      if (!active) return true
      onToken('')
      setFailed(true)
      void initObservability()?.then(sentry => sentry?.captureException(new Error('Verification unavailable'), {
        tags: { operation: 'turnstile.challenge', code: /^\d{6}$/.test(code) ? code : 'script_error' },
      })).catch(() => {})
      return true
    }
    const render = () => {
      if (!active || !targetRef.current || !window.turnstile || widgetId) return
      widgetId = window.turnstile.render(targetRef.current, {
        sitekey: siteKey,
        callback: token => { if (active) { setFailed(false); onToken(token) } },
        'expired-callback': () => { if (active) onToken('') },
        'error-callback': fail,
        retry: 'never',
      })
    }
    const scriptError = () => fail('script_error')
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (script?.dataset.failed === 'true') { script.remove(); script = null }
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.head.append(script)
    }
    const onScriptError = () => { script!.dataset.failed = 'true'; scriptError() }
    script.addEventListener('load', render)
    script.addEventListener('error', onScriptError)
    render()
    return () => {
      active = false
      script?.removeEventListener('load', render)
      script?.removeEventListener('error', onScriptError)
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [attempt, onToken, siteKey])

  return siteKey ? <div className="turnstile-widget">
    <div ref={targetRef} />
    {failed && <div role="alert">
      <p>{messages.turnstile.unavailable}</p>
      <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>{messages.turnstile.retry}</button>
    </div>}
  </div> : null
}
