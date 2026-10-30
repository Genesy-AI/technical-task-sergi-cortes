import type { ProviderId } from './catalog'
import type { EnrichableLead } from './providers/types'
import type { PhoneEnrichmentProgress, ProviderAttempt } from './types'

/**
 * Where the workflow's activities read leads and record enrichment progress and outcomes.
 *
 * Every method must be idempotent, because activities retry, and must ignore a lead deleted in the meantime
 * rather than fail, so a deletion cannot make the workflow retry forever. Writes must touch only the phone and
 * the enrichment fields, so a phone lookup and an email verification can run on one lead at once.
 *
 * `PrismaPhoneEnrichmentStore` in `prismaStore.ts` implements it on the lead row, using the fields
 * `phoneEnrichmentStatus`, `phoneEnrichmentProgress`, `phoneSource`, `phoneEnrichmentAttempts`, and `phoneEnrichedAt`.
 */
export interface PhoneEnrichmentStore {
  /** The lead's lookup inputs, or null when it no longer exists. */
  loadLead(leadId: number): Promise<EnrichableLead | null>

  /** Marks which provider is being tried: sets the step and the attempts so far. */
  recordProgress(leadId: number, progress: PhoneEnrichmentProgress): Promise<void>

  /**
   * Records a found phone: sets the phone, its source, status `FOUND`, the attempts, and the end time,
   * and clears the step. It replaces an existing phone, since re-enrichment is how a user asks for that.
   */
  savePhone(
    leadId: number,
    found: { phone: string; source: ProviderId; attempts: ProviderAttempt[] }
  ): Promise<void>

  /** Records a lookup that found nothing: sets the status, the attempts, and the end time, and clears the step. */
  saveOutcome(
    leadId: number,
    outcome: { status: 'NOT_FOUND' | 'FAILED'; attempts: ProviderAttempt[] }
  ): Promise<void>
}
