import { PrismaClient } from '@prisma/client'
import type { VerificationOutcome } from '../types'
import { verifyEmail } from './verifyEmail'

/** Builds the activities, giving the ones that persist results access to the database. */
export function createActivities(prisma: PrismaClient) {
  return {
    verifyEmail,

    /** Records a verification outcome; a lead deleted in the meantime is ignored rather than retried. */
    async saveVerificationResult(leadId: number, status: VerificationOutcome): Promise<void> {
      await prisma.lead.updateMany({ where: { id: leadId }, data: { emailVerificationStatus: status } })
    },
  }
}

export type Activities = ReturnType<typeof createActivities>
