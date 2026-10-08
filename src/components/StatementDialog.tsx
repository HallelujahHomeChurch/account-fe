import { useEffect, useRef, useState, type ReactNode } from 'react'

type Inline =
  | { type: 'text'; text: string; marks?: ('strong' | 'emphasis')[]; color?: string; highlight?: string }
  | { type: 'lineBreak' }
  | { type: 'link'; href: string; title?: string; content: Inline[] }
type Block =
  | { id: string; type: 'paragraph' | 'heading' | 'quote'; level?: 2 | 3; alignment?: 'start' | 'center' | 'end'; content?: Inline[]; source?: Inline[] }
  | { id: string; type: 'list'; ordered: boolean; items: { content: Inline[] }[] }
  | { id: string; type: 'image'; url: string; size?: 'small' | 'medium' | 'full'; alignment?: 'start' | 'center' | 'end'; alt: { mode: 'text'; text: string } | { mode: 'decorative' }; caption?: Inline[] }
export type StatementContent = { title: string; body?: string; bodyJson?: { schemaVersion: 1; blocks: Block[] }; resolvedLocale: string }
export type StatementLabels = { syncError: string; notice: string; close: string; doNotShowAgain: string; openImage: string; closeImage: string }

function inlines(nodes?: Inline[]): ReactNode {
  return nodes?.map((node, index) => {
    if (node.type === 'lineBreak') return <br key={index} />
    if (node.type === 'link') {
      const safe = /^(https?:\/\/|\/(?!\/))/.test(node.href)
      return safe ? <a key={index} href={node.href} title={node.title} rel="noopener noreferrer">{inlines(node.content)}</a> : <span key={index}>{inlines(node.content)}</span>
    }
    let value: ReactNode = node.text
    if (node.marks?.includes('emphasis')) value = <em>{value}</em>
    if (node.marks?.includes('strong')) value = <strong>{value}</strong>
    return <span key={index} style={{ color: /^#[0-9A-F]{6}$/.test(node.color ?? '') ? node.color : undefined, backgroundColor: /^#[0-9A-F]{6}$/.test(node.highlight ?? '') ? node.highlight : undefined }}>{value}</span>
  })
}

function StatementImage({ src, alt, labels }: { src: string; alt: string; labels: StatementLabels }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  function close() { dialog.current?.close(); trigger.current?.focus() }
  return <>
    <button ref={trigger} type="button" aria-label={alt ? `${labels.openImage}: ${alt}` : labels.openImage} onClick={() => { dialog.current?.showModal(); closeButton.current?.focus() }} className="statement-image-trigger"><img src={src} alt={alt} /></button>
    <dialog ref={dialog} aria-label={labels.openImage} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close() }} className="statement-image-dialog">
      <button ref={closeButton} type="button" aria-label={labels.closeImage} onClick={close}>×</button><img src={src} alt={alt} />
    </dialog>
  </>
}

function StatementBody({ statement, labels }: { statement: StatementContent; labels: StatementLabels }) {
  if (!statement.bodyJson) return <div className="statement-body statement-body-plain" lang={statement.resolvedLocale}>{statement.body}</div>
  return <div className="statement-body" lang={statement.resolvedLocale}>{statement.bodyJson.blocks.map((block) => {
    if (block.type === 'paragraph') return <p key={block.id} style={{ textAlign: block.alignment }}>{inlines(block.content)}</p>
    if (block.type === 'heading') return block.level === 2 ? <h2 key={block.id} style={{ textAlign: block.alignment }}>{inlines(block.content)}</h2> : <h3 key={block.id} style={{ textAlign: block.alignment }}>{inlines(block.content)}</h3>
    if (block.type === 'quote') return <blockquote key={block.id}><p>{inlines(block.content)}</p>{block.source?.length ? <cite>{inlines(block.source)}</cite> : null}</blockquote>
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul'
      return <List key={block.id}>{block.items.map((item, index) => <li key={index}>{inlines(item.content)}</li>)}</List>
    }
    if (block.type === 'image') {
      const alt = block.alt.mode === 'text' ? block.alt.text : ''
      return <figure key={block.id} className={`statement-image statement-image-${block.size ?? 'full'} statement-image-${block.alignment ?? 'center'}`}>
        <StatementImage src={block.url} alt={alt} labels={labels} />
        {block.caption?.length ? <figcaption>{inlines(block.caption)}</figcaption> : null}
      </figure>
    }
    return null
  })}</div>
}

export function StatementDialog({ statement, labels, onClose, saving = false }: { statement: StatementContent; labels: StatementLabels; onClose: (doNotShowAgain: boolean) => void; saving?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [doNotShowAgain, setHideToday] = useState(false)
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    element?.showModal()
    heading.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = overflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  return <dialog ref={dialog} aria-labelledby="account-statement-title" onCancel={(event) => { event.preventDefault(); onClose(doNotShowAgain) }} className="statement-dialog">
    <div className="statement-dialog-layout">
      <header><div><p>{labels.notice}</p><h2 id="account-statement-title" ref={heading} tabIndex={-1} lang={statement.resolvedLocale}>{statement.title}</h2></div><button type="button" disabled={saving} aria-label={labels.close} onClick={() => onClose(doNotShowAgain)}>×</button></header>
      <section><StatementBody statement={statement} labels={labels} /></section>
      <footer><label><input type="checkbox" disabled={saving} checked={doNotShowAgain} onChange={(event) => setHideToday(event.target.checked)} />{labels.doNotShowAgain}</label><button type="button" disabled={saving} onClick={() => onClose(doNotShowAgain)}>{labels.close}</button></footer>
    </div>
  </dialog>
}
