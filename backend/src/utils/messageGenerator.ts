import { TEMPLATE_FIELD_KEYS } from '../leads/leadFields'

/**
 * The values a template can reference, keyed by registry field key.
 * Callers pass the lead view, which includes derived values such as `yearsAtCompany`.
 */
export type Lead = Readonly<Record<string, unknown>>

const PLACEHOLDER = /\{(\w+)\}/g

/**
 * Replaces each `{field}` with the lead's value.
 * Throws for a field that is not templatable in the lead field registry, or that the lead has no value for,
 * so the caller can skip that lead and report why.
 */
export function generateMessageFromTemplate(template: string, lead: Lead): string {
  for (const [, fieldName] of template.matchAll(PLACEHOLDER)) {
    if (!TEMPLATE_FIELD_KEYS.has(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }
    const value = lead[fieldName]
    if (value === null || value === undefined || value === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }
  }

  // A replacer function inserts values literally, so `$&` or `$1` in a value is not treated as a pattern.
  return template.replace(PLACEHOLDER, (_match, fieldName: string) => String(lead[fieldName]))
}
