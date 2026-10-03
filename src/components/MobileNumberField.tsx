import { Input, Label, Select, TextField } from '@hallelujahhomechurch/ui'
import { getCountries, getCountryCallingCode, isSupportedCountry, type CountryCode } from 'libphonenumber-js/min'
import { useMemo, useState } from 'react'
import { useLocale } from '../i18n/locale-context'
import { memberDetailsMessages } from '../i18n/member-details'
import { splitMobile } from '../lib/mobile-number'

export function MobileNumberField({ mobile, isDisabled, onDirty }: { mobile: string | null; isDisabled: boolean; onDirty: () => void }) {
 const { locale } = useLocale()
 const t = memberDetailsMessages[locale]
 const [draft, setDraft] = useState(() => splitMobile(mobile))
 const items = useMemo(() => {
  const names = new Intl.DisplayNames([locale], { type: 'region' })
  return getCountries().map(country => ({ id: country, label: `+${getCountryCallingCode(country)} ${names.of(country) ?? country}`, ariaLabel: `${names.of(country) ?? country} +${getCountryCallingCode(country)}` }))
   .sort((a, b) => a.id === 'TW' ? -1 : b.id === 'TW' ? 1 : a.ariaLabel.localeCompare(b.ariaLabel, locale))
 }, [locale])
 return <div className="member-mobile-row">
  <input type="hidden" name="mobileCountry" value={draft.country} />
  <Select className="member-mobile-country" label={t.countryCode} items={items} selectedKey={draft.country} isDisabled={isDisabled} onSelectionChange={key => {
   if (isSupportedCountry(key)) { setDraft(current => ({ ...current, country: key as CountryCode })); onDirty() }
  }} />
  <TextField name="mobile" type="tel" value={draft.number} isDisabled={isDisabled} autoComplete="off" onChange={number => {
   setDraft(current => ({ ...current, number })); onDirty()
  }} onBlur={() => {
   if (draft.number.normalize('NFKC').trim().startsWith('+')) setDraft(splitMobile(draft.number.normalize('NFKC').trim()))
  }}><Label>{t.mobile}</Label><Input inputMode="tel" /></TextField>
 </div>
}
