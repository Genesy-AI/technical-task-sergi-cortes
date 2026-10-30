import { ActivityFailure, proxyActivities } from '@temporalio/workflow'
import type { Activities } from './activities'
import type { VerificationOutcome } from './types'

// Three attempts of at most 5 seconds with 1 s and 2 s backoff: a check that never answers fails in about 18 s.
// The 2 s heartbeat timeout lets the worker learn quickly that an attempt timed out, so it can stop it.
const { verifyEmail } = proxyActivities<Activities>({
  startToCloseTimeout: '5 seconds',
  heartbeatTimeout: '2 seconds',
  retry: { maximumAttempts: 3, initialInterval: '1 second', backoffCoefficient: 2 },
})

// Saving must eventually succeed, so it retries longer; it is idempotent.
const { saveVerificationResult } = proxyActivities<Activities>({
  startToCloseTimeout: '5 seconds',
  retry: {
    maximumAttempts: 10,
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
  },
})

/**
 * Verifies one lead's email and records the outcome.
 * There is deliberately no workflow timeout: a timed-out workflow runs no more code, which would leave the lead PENDING.
 */
export async function verifyEmailWorkflow(leadId: number, email: string): Promise<VerificationOutcome> {
  let outcome: VerificationOutcome
  try {
    outcome = (await verifyEmail(email)) ? 'VERIFIED' : 'INVALID'
  } catch (error) {
    if (!(error instanceof ActivityFailure)) throw error
    outcome = 'FAILED'
  }

  await saveVerificationResult(leadId, outcome)
  return outcome
}
