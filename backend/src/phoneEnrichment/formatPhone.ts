import { CountryCode, isSupportedCountry, parsePhoneNumberFromString } from 'libphonenumber-js/max'

/**
 * Formats a found number as E.164, trying each country in order for numbers without an international prefix.
 * Uses the full metadata, so "valid" means a real number pattern rather than only a plausible length.
 * A number no country makes valid is kept as the provider returned it, rather than lost.
 */
export function formatPhone(raw: string, countries: ReadonlyArray<string | null | undefined>): string {
  const candidates = countries
    .map((country) => country?.trim().toUpperCase())
    .filter((country): country is CountryCode => !!country && isSupportedCountry(country))

  for (const country of [undefined, ...candidates]) {
    const parsed = parsePhoneNumberFromString(raw, country)
    if (parsed?.isValid()) return parsed.number
  }
  return raw.trim()
}
