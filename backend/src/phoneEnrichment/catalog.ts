/**
 * What the workflow needs to know about each provider: no I/O and no large imports, so it is safe in the workflow sandbox.
 * How to call a provider lives in its module under `providers/`.
 */
export const PROVIDER_CATALOG = {
  ASTRA: { label: 'Astra Dialer', taskQueue: 'phone-astra', attemptTimeoutMs: 5_000 },
  NIMBUS: { label: 'Nimbus Lookup', taskQueue: 'phone-nimbus', attemptTimeoutMs: 8_000 },
  ORION: { label: 'Orion Connect', taskQueue: 'phone-orion', attemptTimeoutMs: 10_000 },
} as const

export type ProviderId = keyof typeof PROVIDER_CATALOG

/** Runs the lookup workflow and its persistence activities; each provider's calls run on the provider's own queue. */
export const PHONE_ENRICHMENT_TASK_QUEUE = 'phone-enrichment'

/** Every phone provider the backend knows, which also names its environment variables. */
export const PROVIDER_IDS = Object.keys(PROVIDER_CATALOG) as ProviderId[]

export const isProviderId = (value: string): value is ProviderId =>
  Object.prototype.hasOwnProperty.call(PROVIDER_CATALOG, value)

/** Every provider call: three attempts with 1 s and 2 s backoff. A 429 replaces the backoff with its Retry-After. */
export const LOOKUP_RETRY_POLICY = {
  maximumAttempts: 3,
  initialInterval: 1_000,
  backoffCoefficient: 2,
} as const

/** The longest a lookup can spend on providers when every attempt times out and no provider rate limits it. */
export function worstCaseLookupMs(order: readonly ProviderId[] = PROVIDER_IDS): number {
  const { maximumAttempts, initialInterval, backoffCoefficient } = LOOKUP_RETRY_POLICY
  let backoffs = 0
  for (let retry = 0; retry < maximumAttempts - 1; retry++)
    backoffs += initialInterval * backoffCoefficient ** retry
  return order.reduce(
    (total, id) => total + maximumAttempts * PROVIDER_CATALOG[id].attemptTimeoutMs + backoffs,
    0
  )
}
