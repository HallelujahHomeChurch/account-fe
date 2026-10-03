import { Input, Label, SearchableSelect, Select, TextField } from '@hallelujahhomechurch/ui'
import { getCountries, getCountryCallingCode, isSupportedCountry, type CountryCode } from 'libphonenumber-js/min'
import { useMemo, useState } from 'react'
import { useLocale } from '../i18n/locale-context'
import { memberDetailsMessages } from '../i18n/member-details'
import { splitMobile } from '../lib/mobile-number'

export function MobileNumberField({ mobile, isDisabled, onDirty }: { mobile: string | null; isDisabled: boolean; onDirty: () => void }) {
 const { locale } = useLocale()
 const t = memberDetailsMessages[locale]
 const [draft, setDraft] = useState(() => splitMobile(mobile))
 const [query, setQuery] = useState('')
 const items = useMemo(() => {
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  const english = new Intl.DisplayNames(['en'], { type: 'region' })
  return getCountries().map(country => ({
   id: country,
   label: `${names.of(country) ?? country} +${getCountryCallingCode(country)}`,
   display: `+${getCountryCallingCode(country)} ${names.of(country) ?? country}`,
   search: `${names.of(country)} ${english.of(country)} ${country} +${getCountryCallingCode(country)}`.normalize('NFKC').toLowerCase(),
  })).sort((a, b) => a.id === 'TW' ? -1 : b.id === 'TW' ? 1 : a.label.localeCompare(b.label, locale))
 }, [locale])
 const filtered = items.filter(item => item.search.includes(query.normalize('NFKC').trim().toLowerCase()))
 const selected = items.find(item => item.id === draft.country)
 return <div className="member-mobile-row">
  <input type="hidden" name="mobileCountry" value={draft.country} />
  {/* Search queries are not member data; country selection explicitly marks the draft dirty. */}
  <div className="member-mobile-country" onChange={event => event.stopPropagation()}>
   {isDisabled ? <Select label={t.countryCode} items={items.map(item => ({ id: item.id, label: item.display, ariaLabel: item.label }))} selectedKey={draft.country} isDisabled /> : <SearchableSelect
    label={t.countryCode} items={filtered} inputValue={query} onInputChange={setQuery}
    selectedKey={draft.country} selectedLabel={selected?.display}
    emptyText={t.noCountries} loadingText={t.countryCode}
    onSelectionChange={key => {
     if (isSupportedCountry(key)) { setDraft(current => ({ ...current, country: key as CountryCode })); onDirty() }
    }}
   />}
  </div>
  <TextField name="mobile" type="tel" value={draft.number} isDisabled={isDisabled} autoComplete="off" onChange={number => {
   setDraft(current => ({ ...current, number })); onDirty()
  }} onBlur={() => {
   if (draft.number.normalize('NFKC').trim().startsWith('+')) setDraft(splitMobile(draft.number.normalize('NFKC').trim()))
  }}><Label>{t.mobile}</Label><Input inputMode="tel" /></TextField>
 </div>
}
