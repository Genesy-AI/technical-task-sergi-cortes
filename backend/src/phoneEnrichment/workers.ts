import { NativeConnection, Worker, WorkerOptions } from '@temporalio/worker'
import path from 'path'
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE } from '../temporal/config'
import { createLookupActivities, createPhoneEnrichmentActivities } from './activities'
import { PHONE_ENRICHMENT_TASK_QUEUE, PROVIDER_CATALOG } from './catalog'
import { loadPhoneEnrichmentConfig, PhoneEnrichmentConfig } from './config'
import { PROVIDERS } from './providers'
import type { PhoneEnrichmentStore } from './store'

export type PhoneWorkerOptions = Omit<WorkerOptions, 'connection' | 'namespace'>

/**
 * One worker for the lookup workflow and its persistence activities, and one per configured provider.
 * A provider's rate limit is set on its own queue, where the Temporal server enforces it across all workers.
 */
export function phoneEnrichmentWorkerOptions({
  config,
  store,
  fetch,
}: {
  config: PhoneEnrichmentConfig
  store: PhoneEnrichmentStore
  fetch?: typeof globalThis.fetch
}): PhoneWorkerOptions[] {
  const workflowWorker: PhoneWorkerOptions = {
    taskQueue: PHONE_ENRICHMENT_TASK_QUEUE,
    // A directory, so the same path works from TypeScript sources and from the build.
    workflowsPath: path.join(__dirname, '../workflows/phone'),
    activities: createPhoneEnrichmentActivities(store, config.order),
  }

  const providerWorkers = config.providers.map(
    ({ id, apiKey, baseUrl, maxPerSecond }): PhoneWorkerOptions => {
      const options: PhoneWorkerOptions = {
        taskQueue: PROVIDER_CATALOG[id].taskQueue,
        activities: createLookupActivities(PROVIDERS[id], { apiKey, baseUrl }, fetch),
      }
      if (maxPerSecond !== undefined) options.maxTaskQueueActivitiesPerSecond = maxPerSecond
      return options
    }
  )

  return [workflowWorker, ...providerWorkers]
}

/**
 * Validates the configuration, then runs every phone enrichment worker on one shared connection until they stop.
 * A missing or invalid setting rejects before connecting, with a message naming each variable.
 */
export async function runPhoneEnrichmentWorkers({
  store,
  env = process.env,
  connect = () => NativeConnection.connect({ address: TEMPORAL_ADDRESS }),
}: {
  store: PhoneEnrichmentStore
  env?: NodeJS.ProcessEnv
  connect?: () => Promise<NativeConnection>
}): Promise<void> {
  const config = loadPhoneEnrichmentConfig(env)
  const connection = await connect()
  try {
    const workers = await Promise.all(
      phoneEnrichmentWorkerOptions({ config, store }).map((options) =>
        Worker.create({ ...options, connection, namespace: TEMPORAL_NAMESPACE })
      )
    )
    await Promise.all(workers.map((worker) => worker.run()))
  } finally {
    await connection.close()
  }
}
