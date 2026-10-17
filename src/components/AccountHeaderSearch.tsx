import { Button, Dialog, ExpandableSearchField } from '@hallelujahhomechurch/ui'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '../i18n/locale-context'
import { findAccountFeatures, type AccountFeatureSearchItem } from '../lib/account-feature-search'

export function AccountHeaderSearch({ mode, value, onChange, items, isDisabled = false, onExpandedChange }: {
  mode: 'features' | 'members'
  value: string
  onChange: (value: string) => void
  items: readonly AccountFeatureSearchItem[]
  isDisabled?: boolean
  onExpandedChange?: (expanded: boolean) => void
}) {
  const { messages: { search: t } } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const results = findAccountFeatures(items, submitted ?? '')
  const label = mode === 'members' ? t.members : t.functions
  return <div className="account-search" data-expanded={expanded}>
    {mode === 'members' && value.trim() && !expanded ? <div className="account-search-applied">
      <span title={value}>{value}</span>
      <Button size="sm" variant="ghost" aria-label={t.clear} onPress={() => onChange('')}>×</Button>
    </div> : null}
    <ExpandableSearchField label={label} placeholder={label} submitLabel={t.submit} clearLabel={t.clear} closeLabel={t.close}
      value={value} isDisabled={isDisabled}
      onChange={next => { if (!isDisabled) onChange(next) }}
      onExpandedChange={next => { setExpanded(next); onExpandedChange?.(next) }}
      onSubmit={query => { if (mode === 'features' && !isDisabled) setSubmitted(query) }} />
    <Dialog isOpen={submitted !== null} title={t.results} closeLabel={t.close} onOpenChange={open => { if (!open) setSubmitted(null) }}>
      {results.length ? <ul className="account-search-results">{results.map(item => <li key={item.id}>
        <Link to={item.to} onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
          setSubmitted(null)
          onChange('')
        }}><strong>{item.label}</strong><span>{item.category}</span></Link>
      </li>)}</ul> : <p role="status">{t.empty}</p>}
    </Dialog>
  </div>
}
