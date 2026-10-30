import { ActivityFailure, CancellationScope, isCancellation, proxyActivities } from '@temporalio/workflow'
import type { LookupActivities, PhoneEnrichmentActivities } from '../../phoneEnrichment/activities'
import {
  LOOKUP_RETRY_POLICY,
  PROVIDER_CATALOG,
  PROVIDER_IDS,
  ProviderId,
} from '../../phoneEnrichment/catalog'
import type { EnrichPhoneResult, ProviderAttempt } from '../../phoneEnrichment/types'

/** One id per lead lets Temporal guarantee that at most one lookup runs for it at a time. */
export const phoneEnrichmentWorkflowId = (leadId: number) => `enrich-phone-${leadId}`

// Recording must eventually succeed, so it retries longer; every store write is idempotent.
const { loadLead, recordProgress, savePhone, saveOutcome } = proxyActivities<PhoneEnrichmentActivities>({
  startToCloseTimeout: '5 seconds',
  retry: {
    maximumAttempts: 10,
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
  },
})

// Each provider runs on its own task queue, so its rate limit applies across all workers, with its own
// time limit per attempt. The retry policy keeps the slowest case, every provider timing out on every attempt,
// at `worstCaseLookupMs()`, about 78 seconds. A 429 overrides the backoff with its Retry-After.
const lookups = {} as Record<ProviderId, LookupActivities['lookupPhone']>
for (const id of PROVIDER_IDS) {
  const { taskQueue, attemptTimeoutMs } = PROVIDER_CATALOG[id]
  lookups[id] = proxyActivities<LookupActivities>({
    taskQueue,
    startToCloseTimeout: attemptTimeoutMs,
    retry: LOOKUP_RETRY_POLICY,
  }).lookupPhone
}

/** The final failure's own message, such as "Nimbus Lookup answered with status 500", rather than the wrapper's. */
const describeFailure = (failure: ActivityFailure) => failure.cause?.message || failure.message

/**
 * Looks up one lead's phone, trying providers in the configured order and stopping at the first phone found.
 * A provider whose final attempt fails is recorded and the next one runs; skipped providers never fail a lookup.
 * Returns null when the lead no longer exists.
 * There is deliberately no workflow timeout: a timed-out workflow runs no more code, which would leave the lead PENDING.
 */
export async function enrichPhoneWorkflow(leadId: number): Promise<EnrichPhoneResult | null> {
  const prepared = await loadLead(leadId)
  if (!prepared) return null

  const { lead, steps } = prepared
  const attempts: ProviderAttempt[] = []

  try {
    for (const [index, { provider, skip }] of steps.entries()) {
      if (skip) {
        attempts.push({ provider, result: 'SKIPPED', reason: skip })
        continue
      }

      await recordProgress(leadId, { provider, position: index + 1, total: steps.length, attempts })
      let lookup
      try {
        lookup = await lookups[provider](lead)
      } catch (error) {
        if (!(error instanceof ActivityFailure) || isCancellation(error)) throw error
        attempts.push({ provider, result: 'ERRORED', error: describeFailure(error) })
        continue
      }

      if (lookup.found) {
        attempts.push({ provider, result: 'FOUND', phone: lookup.phone, rawPhone: lookup.rawPhone })
        await savePhone(leadId, { phone: lookup.phone, source: provider, attempts })
        return { status: 'FOUND', phone: lookup.phone, source: provider, attempts }
      }
      attempts.push({ provider, result: 'NOT_FOUND' })
    }
  } catch (error) {
    // A cancelled lookup still records an outcome, so the lead never stays PENDING with nothing running.
    if (isCancellation(error)) {
      await CancellationScope.nonCancellable(() => saveOutcome(leadId, { status: 'FAILED', attempts }))
    }
    throw error
  }

  const status = attempts.some((attempt) => attempt.result === 'ERRORED') ? 'FAILED' : 'NOT_FOUND'
  await saveOutcome(leadId, { status, attempts })
  return { status, attempts }
}
