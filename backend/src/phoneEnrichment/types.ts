import type { ProviderId } from './catalog'
import type { EnrichableLead } from './providers/types'

/** What happened with one provider in the last lookup, kept per lead so skip reasons and errors are visible. */
export type ProviderAttempt =
  | { provider: ProviderId; result: 'SKIPPED'; reason: string }
  | { provider: ProviderId; result: 'NOT_FOUND' }
  | { provider: ProviderId; result: 'ERRORED'; error: string }
  /** `rawPhone` is what the provider sent, kept for diagnosis since Nimbus may drop leading zeros. */
  | { provider: ProviderId; result: 'FOUND'; phone: string; rawPhone: string }

/** How a lookup ended. `PENDING` and `NOT_STARTED` are set by the start endpoint, never by the workflow. */
export type PhoneEnrichmentOutcome = 'FOUND' | 'NOT_FOUND' | 'FAILED'

/** One provider in the lookup's order, with the reason it is skipped for this lead, if it is. */
export interface LookupStep {
  provider: ProviderId
  skip?: string
}

/** The lead and the providers to try, fixed when the lookup starts so a config change cannot alter a running one. */
export interface PreparedLookup {
  lead: EnrichableLead
  steps: LookupStep[]
}

/** The provider being tried, and its 1-based position among all providers in the order. */
export interface PhoneEnrichmentProgress {
  provider: ProviderId
  position: number
  total: number
  /** What happened with the earlier providers, including skips. */
  attempts: ProviderAttempt[]
}

export interface EnrichPhoneResult {
  status: PhoneEnrichmentOutcome
  phone?: string
  source?: ProviderId
  attempts: ProviderAttempt[]
}
