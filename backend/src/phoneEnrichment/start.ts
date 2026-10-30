import { Client } from '@temporalio/client'
import { enrichPhoneWorkflow, phoneEnrichmentWorkflowId } from '../workflows/phone/enrichPhoneWorkflow'
import { PHONE_ENRICHMENT_TASK_QUEUE } from './catalog'

/** Starts, or joins, the background phone lookup of one lead. Resolves once it is running. */
export type StartPhoneEnrichment = (leadId: number) => Promise<void>

export function temporalPhoneEnrichmentStarter(getClient: () => Promise<Client>): StartPhoneEnrichment {
  return async (leadId) => {
    const client = await getClient()
    await client.workflow.start(enrichPhoneWorkflow, {
      taskQueue: PHONE_ENRICHMENT_TASK_QUEUE,
      workflowId: phoneEnrichmentWorkflowId(leadId),
      args: [leadId],
      // A start while one is running joins it; a start after it ended begins a new run.
      workflowIdConflictPolicy: 'USE_EXISTING',
      workflowIdReusePolicy: 'ALLOW_DUPLICATE',
    })
  }
}
