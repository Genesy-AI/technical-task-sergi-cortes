import './loadEnv'
import { PrismaClient } from '@prisma/client'
import { createApp } from './app'
import { PrismaPhoneEnrichmentStore } from './phoneEnrichment/prismaStore'
import { runPhoneEnrichmentWorkers } from './phoneEnrichment/workers'
import { runTemporalWorker } from './worker'

const prisma = new PrismaClient()
const app = createApp(prisma)

app.listen(4000, () => {
  console.log('Express server is running on port 4000')
})

runTemporalWorker(prisma).catch((err) => {
  console.error(err)
  process.exit(1)
})

// Phone enrichment needs provider keys; without them only these workers stay off, and the rest of the app runs.
runPhoneEnrichmentWorkers({ store: new PrismaPhoneEnrichmentStore(prisma) }).catch((err) => {
  console.error(`Phone enrichment workers not started: ${err instanceof Error ? err.message : err}`)
})
