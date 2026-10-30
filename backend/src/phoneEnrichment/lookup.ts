import { ApplicationFailure } from '@temporalio/common'
import { PROVIDER_CATALOG } from './catalog'
import type { ProviderSettings } from './config'
import { formatPhone } from './formatPhone'
import { EnrichableLead, PhoneProvider, UnexpectedResponseError } from './providers/types'

/** The failure types a lookup throws, so the workflow history says why a provider errored. */
export const LookupFailureType = {
  /** The lead lacks the provider's inputs; the workflow skips such providers, so this signals a bug. */
  InputMissing: 'ProviderInputMissing',
  /** 400, 401, or 403: retrying the same request cannot succeed. */
  RequestRejected: 'ProviderRequestRejected',
  /** 429: retried after the provider's Retry-After, when it sends one. */
  RateLimited: 'ProviderRateLimited',
  /** Any other error status, or a network error. */
  Unavailable: 'ProviderUnavailable',
  /** The attempt ran out of time and its request was aborted. */
  Timeout: 'ProviderTimeout',
  /** A success status with a body that is not the expected JSON. */
  BadResponse: 'ProviderBadResponse',
} as const

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403])

export type LookupResult = { found: true; phone: string; rawPhone: string } | { found: false }

export interface LookupOptions {
  /** Aborts the request, for example when Temporal cancels the attempt. Its reason is rethrown unchanged. */
  signal?: AbortSignal
  /** Aborts the request after this long and fails the attempt as retryable. */
  timeoutMs?: number
  fetch?: typeof fetch
}

/** Seconds or an HTTP date, per RFC 9110; anything else leaves the delay to the retry policy. */
function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined
  const value = header.trim()
  const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now()
  return Number.isFinite(ms) && ms > 0 ? ms : undefined
}

/** Rejects a failed answer with a failure the retry policy understands, never echoing the request or its key. */
function failForStatus(label: string, response: Response): never {
  const { status } = response
  if (NON_RETRYABLE_STATUSES.has(status)) {
    throw ApplicationFailure.nonRetryable(
      `${label} rejected the request with status ${status}`,
      LookupFailureType.RequestRejected
    )
  }
  if (status === 429) {
    throw ApplicationFailure.create({
      message: `${label} is rate limiting requests (status 429)`,
      type: LookupFailureType.RateLimited,
      nextRetryDelay: retryAfterMs(response.headers.get('retry-after')),
    })
  }
  throw ApplicationFailure.retryable(`${label} answered with status ${status}`, LookupFailureType.Unavailable)
}

async function readJsonObject(label: string, response: Response): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw ApplicationFailure.retryable(`${label} answered with invalid JSON`, LookupFailureType.BadResponse)
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw ApplicationFailure.retryable(
      `${label} answered with a non-object body`,
      LookupFailureType.BadResponse
    )
  }
  return body as Record<string, unknown>
}

/**
 * Looks up one lead's phone with one provider: builds its input, calls it, and formats what it found.
 * Errors become `ApplicationFailure`s whose retryability follows the design: request errors are final,
 * rate limits honor Retry-After, and server errors, network errors, and timeouts are retried.
 */
export async function lookupPhone<Input>(
  provider: PhoneProvider<Input>,
  settings: Pick<ProviderSettings, 'apiKey' | 'baseUrl'>,
  lead: EnrichableLead,
  { signal, timeoutMs, fetch: fetchFn = fetch }: LookupOptions = {}
): Promise<LookupResult> {
  const { label } = PROVIDER_CATALOG[provider.id]
  const plan = provider.inputFrom(lead)
  if ('skip' in plan) {
    throw ApplicationFailure.nonRetryable(
      `${label} cannot be used: ${plan.skip}`,
      LookupFailureType.InputMissing
    )
  }

  const timeout = timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs)
  const signals = [signal, timeout].filter((s): s is AbortSignal => s !== undefined)
  const requestSignal = signals.length > 0 ? AbortSignal.any(signals) : undefined

  const { url, headers, body } = provider.request(plan.input, settings)
  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: requestSignal,
    })
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error
    if (timeout?.aborted) {
      throw ApplicationFailure.retryable(
        `${label} did not answer within ${timeoutMs} ms`,
        LookupFailureType.Timeout
      )
    }
    const reason = error instanceof Error ? error.message : String(error)
    throw ApplicationFailure.retryable(
      `${label} could not be reached: ${reason}`,
      LookupFailureType.Unavailable
    )
  }

  if (!response.ok) failForStatus(label, response)

  let normalized
  try {
    normalized = provider.normalize(await readJsonObject(label, response))
  } catch (error) {
    if (!(error instanceof UnexpectedResponseError)) throw error
    throw ApplicationFailure.retryable(
      `${label} answered unexpectedly: ${error.message}`,
      LookupFailureType.BadResponse
    )
  }
  if ('notFound' in normalized) return { found: false }

  return {
    found: true,
    phone: formatPhone(normalized.phone, [normalized.country, lead.countryCode]),
    rawPhone: normalized.phone,
  }
}
