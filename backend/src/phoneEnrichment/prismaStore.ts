import { Prisma, PrismaClient } from '@prisma/client'
import type { ProviderId } from './catalog'
import type { EnrichableLead } from './providers/types'
import type { PhoneEnrichmentStore } from './store'
import type { PhoneEnrichmentProgress, ProviderAttempt } from './types'

const asJson = (value: unknown) => value as Prisma.InputJsonValue

/**
 * Stores enrichment state on the lead row. Every write uses `updateMany`, so a lead deleted mid-lookup
 * is ignored instead of making the activity retry, and touches only phone and enrichment columns,
 * so it cannot overwrite an email verification running on the same lead.
 */
export class PrismaPhoneEnrichmentStore implements PhoneEnrichmentStore {
  constructor(private readonly prisma: PrismaClient) {}

  async loadLead(leadId: number): Promise<EnrichableLead | null> {
    return this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { firstName: true, lastName: true, email: true, jobTitle: true, countryCode: true },
    })
  }

  async recordProgress(leadId: number, { provider, position, total, attempts }: PhoneEnrichmentProgress) {
    await this.prisma.lead.updateMany({
      where: { id: leadId },
      data: {
        phoneEnrichmentProgress: asJson({ provider, position, total }),
        phoneEnrichmentAttempts: asJson(attempts),
      },
    })
  }

  async savePhone(
    leadId: number,
    { phone, source, attempts }: { phone: string; source: ProviderId; attempts: ProviderAttempt[] }
  ) {
    await this.prisma.lead.updateMany({
      where: { id: leadId },
      data: {
        phone,
        phoneSource: source,
        phoneEnrichmentStatus: 'FOUND',
        phoneEnrichmentProgress: Prisma.DbNull,
        phoneEnrichmentAttempts: asJson(attempts),
        phoneEnrichedAt: new Date(),
      },
    })
  }

  async saveOutcome(
    leadId: number,
    { status, attempts }: { status: 'NOT_FOUND' | 'FAILED'; attempts: ProviderAttempt[] }
  ) {
    await this.prisma.lead.updateMany({
      where: { id: leadId },
      data: {
        phoneEnrichmentStatus: status,
        phoneEnrichmentProgress: Prisma.DbNull,
        phoneEnrichmentAttempts: asJson(attempts),
        phoneEnrichedAt: new Date(),
      },
    })
  }
}
