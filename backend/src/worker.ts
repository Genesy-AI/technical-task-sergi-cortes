import { PrismaClient } from '@prisma/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import { TEMPORAL_ADDRESS, TEMPORAL_NAMESPACE, TEMPORAL_TASK_QUEUE } from './temporal/config'
import { createActivities } from './workflows/activities'

export async function runTemporalWorker(prisma: PrismaClient) {
  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS })
  try {
    const worker = await Worker.create({
      connection,
      namespace: TEMPORAL_NAMESPACE,
      taskQueue: TEMPORAL_TASK_QUEUE,
      workflowsPath: require.resolve('./workflows'),
      activities: createActivities(prisma),
    })

    await worker.run()
  } finally {
    await connection.close()
  }
}
