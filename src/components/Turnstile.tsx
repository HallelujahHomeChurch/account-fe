import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (target: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void }) => string
      remove: (widgetId: string) => void
    }
  }
}

const scriptId = 'cloudflare-turnstile-script'

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const targetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!siteKey || !targetRef.current) return
    let widgetId = ''
    const render = () => {
      if (!targetRef.current || !window.turnstile || widgetId) return
      widgetId = window.turnstile.render(targetRef.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
      })
    }
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.head.append(script)
    }
    script.addEventListener('load', render)
    render()
    return () => {
      script?.removeEventListener('load', render)
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [onToken, siteKey])

  return siteKey ? <div className="turnstile-widget" ref={targetRef} /> : null
}
