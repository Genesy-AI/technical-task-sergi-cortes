/**
 * Validation and normalization rules for lead profile values.
 * Every rule returns the same shape so the import preview can explain what happened to each value:
 * - `kept`: valid as given (surrounding whitespace aside).
 * - `converted`: valid after rewriting to the canonical form.
 * - `cleared`: not valid, so stored blank, with a `note` for the preview.
 * - `empty`: no value given.
 */
export type ValueOutcome = 'kept' | 'converted' | 'cleared' | 'empty'

export interface NormalizedValue<T> {
  value: T | null
  outcome: ValueOutcome
  note?: string
}

const empty = <T>(): NormalizedValue<T> => ({ value: null, outcome: 'empty' })
const cleared = <T>(note: string): NormalizedValue<T> => ({ value: null, outcome: 'cleared', note })
const accepted = <T>(value: T, original: unknown): NormalizedValue<T> => ({
  value,
  outcome: value === original || String(value) === String(original).trim() ? 'kept' : 'converted',
})

const asText = (input: unknown): string => (input == null ? '' : String(input).trim())

const PHONE_CHARACTERS = /^\+?[\d\s().-]+(?:\s*(?:x|ext\.?)\s*\d+)?$/i
const PHONE_EXTENSION = /\s*(?:x|ext\.?)\s*\d+$/i

/** Keeps phone text as written, with an optional extension, when it has 7 to 15 digits before the extension. */
export function normalizePhone(input: unknown): NormalizedValue<string> {
  const text = asText(input)
  if (!text) return empty()

  const collapsed = text.replace(/\s+/g, ' ')
  if (!PHONE_CHARACTERS.test(collapsed)) return cleared(`${text} is not a phone number`)

  const digits = collapsed.replace(PHONE_EXTENSION, '').replace(/\D/g, '').length
  if (digits < 7) return cleared(`${text} has fewer than 7 digits`)
  if (digits > 15) return cleared(`${text} has more than 15 digits`)

  return { value: collapsed, outcome: collapsed === String(input) ? 'kept' : 'converted' }
}

const LINKEDIN_PROFILE_PATH = /^\/in\/([^/]+)\/?$/

/** Rewrites any LinkedIn personal profile URL to `https://www.linkedin.com/in/<slug>`. */
export function normalizeLinkedinUrl(input: unknown): NormalizedValue<string> {
  const text = asText(input)
  if (!text) return empty()

  const notProfile = cleared<string>(`${text} is not a LinkedIn profile URL`)
  let url: URL
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`)
  } catch {
    return notProfile
  }

  const host = url.hostname.toLowerCase()
  const isLinkedinHost = host === 'linkedin.com' || host.endsWith('.linkedin.com')
  const slug = url.pathname.match(LINKEDIN_PROFILE_PATH)?.[1]
  if (!['http:', 'https:'].includes(url.protocol) || !isLinkedinHost || !slug) return notProfile

  return accepted(`https://www.linkedin.com/in/${slug}`, text)
}

/** Accepts whole years from 0 to 80, given as a number or as text. */
export function normalizeYearsInRole(input: unknown): NormalizedValue<number> {
  const text = asText(input)
  if (!text) return empty()

  if (!/^\d+$/.test(text) || Number(text) > 80) {
    return cleared(`${text} is not a whole number of years from 0 to 80`)
  }
  return accepted(Number(text), input)
}

const CURRENT_ROLE_VALUES = new Set(['true', 'yes', '1', 'x'])

/** Reads the optional `isCurrentRole` CSV column. */
export const isCurrentRoleFlag = (input: unknown): boolean =>
  CURRENT_ROLE_VALUES.has(asText(input).toLowerCase())
