import { Context } from '@temporalio/activity'
import type { CallSpacer } from './callSpacing'
import type { ProviderId } from './catalog'
import type { ProviderSettings } from './config'
import { lookupPhone, LookupResult } from './lookup'
import { PROVIDERS } from './providers'
import type { EnrichableLead, PhoneProvider } from './providers/types'
import type { PhoneEnrichmentStore } from './store'
import type { PreparedLookup } from './types'

/**
 * The activities that read and record a lookup, run on the phone enrichment queue.
 * `order` is the configured provider order; `loadLead` fixes it, with each provider's skip reason, for the run.
 */
export function createPhoneEnrichmentActivities(store: PhoneEnrichmentStore, order: readonly ProviderId[]) {
  return {
    async loadLead(leadId: number): Promise<PreparedLookup | null> {
      const lead = await store.loadLead(leadId)
      if (!lead) return null

      const steps = order.map((provider) => {
        const input = PROVIDERS[provider].inputFrom(lead)
        return 'skip' in input ? { provider, skip: input.skip } : { provider }
      })
      return { lead, steps }
    },

    recordProgress: (...args: Parameters<PhoneEnrichmentStore['recordProgress']>) =>
      store.recordProgress(...args),
    savePhone: (...args: Parameters<PhoneEnrichmentStore['savePhone']>) => store.savePhone(...args),
    saveOutcome: (...args: Parameters<PhoneEnrichmentStore['saveOutcome']>) => store.saveOutcome(...args),
  }
}

export type PhoneEnrichmentActivities = ReturnType<typeof createPhoneEnrichmentActivities>

/**
 * The lookup activity for one provider, registered under the same name on that provider's own task queue.
 * Each attempt's request is aborted when the attempt's start-to-close time runs out, since the worker would
 * otherwise only learn of the timeout through heartbeats, and when Temporal cancels the attempt.
 * With `spacing`, an attempt first waits for its turn, and that wait counts against its start-to-close time.
 */
export function createLookupActivities(
  provider: PhoneProvider<unknown>,
  settings: Pick<ProviderSettings, 'apiKey' | 'baseUrl'>,
  fetchFn?: typeof fetch,
  spacing?: CallSpacer
) {
  return {
    async lookupPhone(lead: EnrichableLead): Promise<LookupResult> {
      const { cancellationSignal, info } = Context.current()
      const startedAt = Date.now()
      await spacing?.(cancellationSignal)
      return lookupPhone(provider, settings, lead, {
        signal: cancellationSignal,
        timeoutMs: info.startToCloseTimeoutMs - (Date.now() - startedAt),
        fetch: fetchFn,
      })
    },
  }
}

export type LookupActivities = ReturnType<typeof createLookupActivities>
