import { PrismaClient } from '@prisma/client'
import { createApp } from './app'
import { runTemporalWorker } from './worker'

const prisma = new PrismaClient()
const app = createApp(prisma)

app.listen(4000, () => {
  console.log('Express server is running on port 4000')
})

runTemporalWorker().catch((err) => {
  console.error(err)
  process.exit(1)
})
