import countries from 'i18n-iso-countries'
import english from 'i18n-iso-countries/langs/en.json'

countries.registerLocale(english)

/**
 * - `kept`: the input was already a valid alpha-2 code, ignoring surrounding whitespace.
 * - `converted`: the input identified exactly one country and was rewritten to its code.
 * - `cleared`: the input was not empty but identified no single country.
 * - `empty`: the input was missing or blank.
 */
export type CountryCodeOutcome = 'kept' | 'converted' | 'cleared' | 'empty'

export interface CountryCodeResult {
  /** Uppercase ISO 3166-1 alpha-2 code, or null when blank. */
  code: string | null
  outcome: CountryCodeOutcome
}

/** Codes ISO reserves for other uses that are common in real data. */
const RESERVED_ALIASES: Readonly<Record<string, string>> = { UK: 'GB', EL: 'GR' }

const ALPHA2_CODES = new Set(Object.keys(countries.getAlpha2Codes()))

/** Lowercases and strips accents, punctuation, extra spaces, and a leading "the". */
const normalizeName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')

/**
 * Maps every normalized English name to the codes that use it.
 * The library's own lookup returns the first match, which would silently pick one country for a shared name such as "Congo".
 */
const NAME_INDEX: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const index = new Map<string, Set<string>>()
  for (const [code, names] of Object.entries(countries.getNames('en', { select: 'all' }))) {
    for (const name of names) {
      const key = normalizeName(name)
      const codes = index.get(key) ?? new Set<string>()
      codes.add(code)
      index.set(key, codes)
    }
  }
  return index
})()

const resolve = (value: string): string | null => {
  const upper = value.toUpperCase()

  if (RESERVED_ALIASES[upper]) return RESERVED_ALIASES[upper]
  if (/^[A-Z]{2}$/.test(upper)) return ALPHA2_CODES.has(upper) ? upper : null
  if (/^[A-Z]{3}$/.test(upper)) {
    const fromAlpha3 = countries.alpha3ToAlpha2(upper)
    // A three-letter value that is not an ISO code may still be an English alias, such as "UAE".
    if (fromAlpha3) return fromAlpha3
  }
  if (/^\d{1,3}$/.test(value)) return countries.numericToAlpha2(value.padStart(3, '0')) ?? null

  const codes = NAME_INDEX.get(normalizeName(value))
  return codes?.size === 1 ? [...codes][0] : null
}

/**
 * Converts a free-form country value to an uppercase ISO 3166-1 alpha-2 code.
 * Accepts alpha-2 and alpha-3 codes in any case, numeric codes, the aliases UK and EL, and exact English names.
 * Anything ambiguous or unknown resolves to null instead of a guess.
 */
export function normalizeCountryCode(input: string | null | undefined): CountryCodeResult {
  const value = input?.trim() ?? ''
  if (!value) return { code: null, outcome: 'empty' }

  const code = resolve(value)
  if (!code) return { code: null, outcome: 'cleared' }
  return { code, outcome: code === value ? 'kept' : 'converted' }
}
