import type { ProviderId } from '../catalog'

/** What providers may use from a lead. */
export interface EnrichableLead {
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  /** ISO 3166-1 alpha-2, used to format numbers the provider returns without a country. */
  countryCode: string | null
}

/** The provider's request input, or why the lead cannot be looked up with this provider. */
export type ProviderInput<Input> = { input: Input } | { skip: string }

/** One HTTP call to a provider. Every provider is called with POST and a JSON body. */
export interface ProviderRequest {
  url: string
  headers: Record<string, string>
  body: unknown
}

/** A phone as the provider returned it, with the country it gave, if any. */
export type NormalizedResponse = { phone: string; country?: string } | { notFound: true }

/** Thrown by `normalize` when a response has an unexpected shape, which is treated as a retryable failure. */
export class UnexpectedResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnexpectedResponseError'
  }
}

/**
 * Everything specific to one provider: which inputs it needs, how to call it, and how to read its answer.
 * Adding a provider means one module implementing this and one entry in the catalog and registry.
 */
export interface PhoneProvider<Input = unknown> {
  id: ProviderId
  inputFrom(lead: EnrichableLead): ProviderInput<Input>
  request(input: Input, credentials: { apiKey: string; baseUrl: string }): ProviderRequest
  normalize(body: Record<string, unknown>): NormalizedResponse
}

/**
 * Reads a phone field that may be a string or, as Nimbus sends it, a JSON number.
 * Missing, null, and blank values mean the provider found nothing.
 */
export function readPhoneField(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value.trim() || undefined
  throw new UnexpectedResponseError(`"${field}" is neither a string nor a number`)
}
