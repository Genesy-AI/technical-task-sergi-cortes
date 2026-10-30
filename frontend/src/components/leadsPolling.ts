import { LeadsGetManyOutput } from '../api/types/leads/getMany'

/** How often the leads list refreshes while a background verification is running. */
export const PENDING_POLL_MS = 2_000

/** Polls only while some lead is still being verified, so an idle table makes no requests. */
export const pollIntervalFor = (leads: LeadsGetManyOutput | undefined): number | false =>
  leads?.some((lead) => lead.emailVerificationStatus === 'PENDING') ? PENDING_POLL_MS : false
