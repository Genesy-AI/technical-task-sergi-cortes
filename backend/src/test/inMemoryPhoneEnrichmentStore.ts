import type { ProviderId } from '../phoneEnrichment/catalog'
import type { EnrichableLead } from '../phoneEnrichment/providers/types'
import type { PhoneEnrichmentStore } from '../phoneEnrichment/store'
import type { PhoneEnrichmentProgress, ProviderAttempt } from '../phoneEnrichment/types'

export interface StoredEnrichment {
  lead: EnrichableLead
  phone: string | null
  status: 'PENDING' | 'FOUND' | 'NOT_FOUND' | 'FAILED'
  step: ProviderId | null
  source: ProviderId | null
  attempts: ProviderAttempt[] | null
  enrichedAt: Date | null
  /** Every progress update, in order, so tests can assert what the UI would have seen. */
  progress: PhoneEnrichmentProgress[]
}

/** Keeps leads in memory and follows the store contract, so workflow tests need no database fields. */
export class InMemoryPhoneEnrichmentStore implements PhoneEnrichmentStore {
  readonly leads = new Map<number, StoredEnrichment>()
  private nextId = 1

  add(lead: EnrichableLead, phone: string | null = null): number {
    const id = this.nextId++
    this.leads.set(id, {
      lead,
      phone,
      status: 'PENDING',
      step: null,
      source: null,
      attempts: null,
      enrichedAt: null,
      progress: [],
    })
    return id
  }

  get(leadId: number): StoredEnrichment {
    const stored = this.leads.get(leadId)
    if (!stored) throw new Error(`No lead ${leadId}`)
    return stored
  }

  async loadLead(leadId: number) {
    return this.leads.get(leadId)?.lead ?? null
  }

  async recordProgress(leadId: number, progress: PhoneEnrichmentProgress) {
    const stored = this.leads.get(leadId)
    if (!stored) return
    stored.step = progress.provider
    stored.attempts = progress.attempts
    stored.progress.push(structuredClone(progress))
  }

  async savePhone(leadId: number, found: { phone: string; source: ProviderId; attempts: ProviderAttempt[] }) {
    const stored = this.leads.get(leadId)
    if (!stored) return
    Object.assign(stored, {
      phone: found.phone,
      source: found.source,
      status: 'FOUND',
      step: null,
      attempts: found.attempts,
      enrichedAt: new Date(),
    })
  }

  async saveOutcome(
    leadId: number,
    outcome: { status: 'NOT_FOUND' | 'FAILED'; attempts: ProviderAttempt[] }
  ) {
    const stored = this.leads.get(leadId)
    if (!stored) return
    Object.assign(stored, {
      status: outcome.status,
      step: null,
      attempts: outcome.attempts,
      enrichedAt: new Date(),
    })
  }
}
