import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

export function normalizeMobile(input: string, country: CountryCode): string | null {
 const value = input.normalize('NFKC').trim()
 if (!value) return null
 const phone = parsePhoneNumberFromString(value, { defaultCountry: country, extract: false })
 return phone && !phone.ext ? phone.number : value
}

export function splitMobile(mobile: string | null): { country: CountryCode; number: string } {
 const phone = mobile ? parsePhoneNumberFromString(mobile, { extract: false }) : undefined
 const country = phone?.country ?? (phone && getCountries().find(candidate => getCountryCallingCode(candidate) === phone.countryCallingCode))
 return phone && country && !phone.ext ? { country, number: phone.nationalNumber } : { country: 'TW', number: mobile ?? '' }
}
