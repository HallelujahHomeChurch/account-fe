import { Button, Dialog } from '@hallelujahhomechurch/ui'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useLocale } from '../i18n/locale-context'
import { externalBrowserHref } from '../lib/line-browser-handoff'

export function LineBrowserHandoff() {
  const { messages } = useLocale()
  const copy = messages.lineBrowser
  const [open, setOpen] = useState(false)
  useEffect(() => {
    document.getElementById('line-browser-retry')?.focus()
    setOpen(true)
  }, [])
  const restarting = new URLSearchParams(window.location.search).has('auth_request_id')
  const description = restarting ? copy.restartAuth : copy.description
  const href = externalBrowserHref(window.location.href)

  return <main className="line-browser-handoff">
    <section aria-labelledby="line-browser-brand">
      <img className="line-browser-handoff__logo" src="/assets/brand/logo.png" alt="" width={80} height={80} />
      <h1 id="line-browser-brand">{messages.site.pageTitle}</h1>
      <p>{description}</p>
      <Dialog title={copy.title} isOpen={open} onOpenChange={setOpen} isDismissable={false} closeLabel={copy.close} trigger={<Button id="line-browser-retry" variant="secondary">{copy.retry}</Button>}>
        <p>{description}</p>
        <div className="line-browser-handoff-actions">
          <Button variant="secondary" onPress={() => setOpen(false)}>{copy.cancel}</Button>
          {!restarting && <a className="hhc-button hhc-button--primary hhc-button--md" href={href} onClick={() => setOpen(false)}>{copy.open}<ArrowUpRight size={17} aria-hidden="true" /></a>}
        </div>
      </Dialog>
      {!restarting && <p className="line-browser-handoff__manual">{copy.manual}</p>}
    </section>
  </main>
}
