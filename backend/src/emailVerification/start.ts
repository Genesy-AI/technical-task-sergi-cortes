import { Client } from '@temporalio/client'
import { TEMPORAL_TASK_QUEUE } from '../temporal/config'
import { verifyEmailWorkflow } from '../workflows'

/** Starts, or joins, the background verification of one lead's email. Resolves once it is running. */
export type StartVerification = (lead: { id: number; email: string }) => Promise<void>

/** One id per lead lets Temporal guarantee that at most one verification runs for it at a time. */
export const verificationWorkflowId = (leadId: number) => `verify-email-${leadId}`

export function temporalVerificationStarter(
  getClient: () => Promise<Client>,
  taskQueue: string = TEMPORAL_TASK_QUEUE
): StartVerification {
  return async (lead) => {
    const client = await getClient()
    await client.workflow.start(verifyEmailWorkflow, {
      taskQueue,
      workflowId: verificationWorkflowId(lead.id),
      args: [lead.id, lead.email],
      // A start while one is running joins it; a start after it ended begins a new run.
      workflowIdConflictPolicy: 'USE_EXISTING',
      workflowIdReusePolicy: 'ALLOW_DUPLICATE',
    })
  }
}
