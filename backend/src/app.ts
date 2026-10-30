import { Prisma, PrismaClient } from '@prisma/client'
import express, { Express, Request, Response } from 'express'
import { StartVerification, temporalVerificationStarter } from './emailVerification/start'
import { buildImport } from './leads/importLeads'
import { emailsInRows, executeImport, findExistingEmails } from './leads/importStore'
import { publicFieldDefinitions } from './leads/leadFields'
import { toLeadView, withRoles } from './leads/leadView'
import { getTemporalClient } from './temporal/client'
import { StartPhoneEnrichment, temporalPhoneEnrichmentStarter } from './phoneEnrichment/start'
import { generateMessageFromTemplate } from './utils/messageGenerator'

/** Upper bound on CSV rows per import request; files in this product are far smaller. */
const MAX_IMPORT_ROWS = 5000
/** Upper bound on leads per verification request, so one request cannot start unbounded work. */
const MAX_VERIFY_LEADS = 500

/** Returns the ids when they are a non-empty, bounded list of positive integers, or null. */
const validLeadIds = (leadIds: unknown): number[] | null =>
  Array.isArray(leadIds) &&
  leadIds.length > 0 &&
  leadIds.length <= MAX_VERIFY_LEADS &&
  leadIds.every((id) => Number.isInteger(id) && id > 0)
    ? [...new Set(leadIds as number[])]
    : null

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error')

/** Returns the rows when they are a bounded array of objects, or an error message. */
const validImportRows = (rows: unknown): Record<string, unknown>[] | string => {
  if (!Array.isArray(rows)) return 'rows must be an array of CSV row objects'
  if (rows.length > MAX_IMPORT_ROWS) return `rows must contain at most ${MAX_IMPORT_ROWS} entries`
  if (!rows.every((row) => row !== null && typeof row === 'object' && !Array.isArray(row))) {
    return 'every row must be an object of column name to value'
  }
  return rows as Record<string, unknown>[]
}

export interface AppDependencies {
  /** Defaults to starting a Temporal workflow through the shared client. */
  startEmailVerification?: StartVerification
  /** Defaults to starting the phone lookup workflow through the shared client. */
  startPhoneEnrichment?: StartPhoneEnrichment
}

/**
 * Builds the HTTP API without starting a server or the Temporal worker,
 * so tests can exercise routes against their own database.
 */
export function createApp(
  prisma: PrismaClient,
  {
    startEmailVerification = temporalVerificationStarter(getTemporalClient),
    startPhoneEnrichment = temporalPhoneEnrichmentStarter(getTemporalClient),
  }: AppDependencies = {}
): Express {
  const app = express()
  // Large enough for MAX_UPLOAD_FILE_SIZE (2 MB) CSV files sent as rows.
  app.use(express.json({ limit: '2mb' }))

  const planImport = async (rows: Record<string, unknown>[]) => {
    const draft = buildImport(rows, new Set())
    return buildImport(rows, await findExistingEmails(prisma, emailsInRows(draft)))
  }

  app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

    if (req.method === 'OPTIONS') {
      res.sendStatus(200)
      return
    }

    next()
  })

  app.post('/leads', async (req: Request, res: Response) => {
    const { name, lastName, email } = req.body

    if (!name || !lastName || !email) {
      return res.status(400).json({ error: 'firstName, lastName, and email are required' })
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: String(name),
        lastName: String(lastName),
        email: String(email),
      },
    })
    res.json(lead)
  })

  // Registered before `/leads/:id`, which would otherwise treat "fields" as an id.
  app.get('/leads/fields', (_req: Request, res: Response) => {
    res.json({ fields: publicFieldDefinitions() })
  })

  app.get('/leads/:id', async (req: Request, res: Response) => {
    const { id } = req.params
    const lead = await prisma.lead.findUnique({
      where: {
        id: Number(id),
      },
    })
    res.json(lead)
  })

  app.get('/leads', async (req: Request, res: Response) => {
    const leads = await prisma.lead.findMany({ include: withRoles, orderBy: { id: 'asc' } })

    res.json(leads.map(toLeadView))
  })

  app.patch('/leads/:id', async (req: Request, res: Response) => {
    const { id } = req.params
    const { name, email } = req.body
    const lead = await prisma.lead.update({
      where: {
        id: Number(id),
      },
      data: {
        firstName: String(name),
        email: String(email),
      },
    })
    res.json(lead)
  })

  app.delete('/leads/:id', async (req: Request, res: Response) => {
    const { id } = req.params
    await prisma.lead.delete({
      where: {
        id: Number(id),
      },
    })
    res.json()
  })

  app.delete('/leads', async (req: Request, res: Response) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
    }

    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }

    try {
      const result = await prisma.lead.deleteMany({
        where: {
          id: {
            in: ids.map((id) => Number(id)),
          },
        },
      })

      res.json({ deletedCount: result.count })
    } catch (error) {
      console.error('Error deleting leads:', error)
      res.status(500).json({ error: 'Failed to delete leads' })
    }
  })

  app.post('/leads/generate-messages', async (req: Request, res: Response) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
    }

    const { leadIds, template } = req.body

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non-empty array' })
    }

    if (!template || typeof template !== 'string') {
      return res.status(400).json({ error: 'template must be a non-empty string' })
    }

    try {
      // The lead view includes derived values such as yearsAtCompany, so templates can use them.
      const leads = (
        await prisma.lead.findMany({
          where: {
            id: {
              in: leadIds.map((id) => Number(id)),
            },
          },
          include: withRoles,
        })
      ).map(toLeadView)

      if (leads.length === 0) {
        return res.status(404).json({ error: 'No leads found with the provided IDs' })
      }

      let generatedCount = 0
      const errors: Array<{ leadId: number; leadName: string; error: string }> = []

      for (const lead of leads) {
        try {
          const message = generateMessageFromTemplate(template, lead)

          await prisma.lead.update({
            where: { id: lead.id },
            data: { message },
          })

          generatedCount++
        } catch (error) {
          errors.push({
            leadId: lead.id,
            leadName: `${lead.firstName} ${lead.lastName}`.trim(),
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      res.json({
        success: true,
        generatedCount,
        errors,
      })
    } catch (error) {
      console.error('Error generating messages:', error)
      res.status(500).json({ error: 'Failed to generate messages' })
    }
  })

  // Shows exactly what POST /leads/bulk would store for these rows, computed by the same function.
  app.post('/leads/import/preview', async (req: Request, res: Response) => {
    const rows = validImportRows(req.body?.rows)
    if (typeof rows === 'string') return res.status(400).json({ error: rows })

    try {
      res.json(await planImport(rows))
    } catch (error) {
      console.error('Error previewing import:', error)
      res.status(500).json({ error: 'Failed to preview import' })
    }
  })

  app.post('/leads/bulk', async (req: Request, res: Response) => {
    const rows = validImportRows(req.body?.rows)
    if (typeof rows === 'string') return res.status(400).json({ error: rows })

    try {
      const plan = await planImport(rows)
      if (plan.leads.length === 0) {
        return res
          .status(400)
          .json({ error: 'No valid leads found. firstName, lastName, and a valid email are required.' })
      }

      const { importedCount, errors } = await executeImport(prisma, plan)
      res.json({
        success: true,
        importedCount,
        duplicatesSkipped: plan.leads.filter((lead) => lead.status === 'duplicate').length,
        invalidRows: plan.invalidRows.length,
        errors,
      })
    } catch (error) {
      console.error('Error importing leads:', error)
      res.status(500).json({ error: 'Failed to import leads' })
    }
  })

  // Starts one background phone lookup per lead and returns at once; the table polls for outcomes.
  // Leads that already have a phone are skipped unless `force` asks to replace it.
  app.post('/leads/enrich-phone', async (req: Request, res: Response) => {
    const leadIds = validLeadIds(req.body?.leadIds)
    const force: unknown = req.body?.force ?? false
    if (!leadIds || typeof force !== 'boolean') {
      return res.status(400).json({
        error: `leadIds must be a non-empty array of at most ${MAX_VERIFY_LEADS} positive integers, and force a boolean`,
      })
    }

    try {
      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds } },
        select: { id: true, phone: true },
        orderBy: { id: 'asc' },
      })
      if (leads.length === 0) {
        return res.status(404).json({ error: 'No leads found with the provided IDs' })
      }

      const skipped = leads
        .filter((lead) => lead.phone && !force)
        .map((lead) => ({ leadId: lead.id, reason: 'HAS_PHONE' as const }))
      const toStart = leads.filter((lead) => !lead.phone || force).map((lead) => lead.id)

      if (toStart.length > 0) {
        // Mark first, so the response and the next poll already show progress.
        await prisma.lead.updateMany({
          where: { id: { in: toStart } },
          data: { phoneEnrichmentStatus: 'PENDING', phoneEnrichmentProgress: Prisma.DbNull },
        })
      }

      const outcomes = await Promise.allSettled(toStart.map((leadId) => startPhoneEnrichment(leadId)))
      const started: number[] = []
      const failed: Array<{ leadId: number; error: string }> = []
      outcomes.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') started.push(toStart[index])
        else failed.push({ leadId: toStart[index], error: errorMessage(outcome.reason) })
      })

      if (failed.length > 0) {
        await prisma.lead.updateMany({
          where: { id: { in: failed.map((f) => f.leadId) } },
          data: { phoneEnrichmentStatus: 'FAILED' },
        })
      }

      res.status(202).json({ started, skipped, failed })
    } catch (error) {
      console.error('Error starting phone enrichment:', error)
      res.status(500).json({ error: 'Failed to start phone enrichment' })
    }
  })

  // Starts one background verification per lead and returns at once; the table polls for outcomes.
  app.post('/leads/verify-emails', async (req: Request, res: Response) => {
    const leadIds: unknown = req.body?.leadIds

    if (
      !Array.isArray(leadIds) ||
      leadIds.length === 0 ||
      leadIds.length > MAX_VERIFY_LEADS ||
      !leadIds.every((id) => Number.isInteger(id) && id > 0)
    ) {
      return res
        .status(400)
        .json({ error: `leadIds must be a non-empty array of at most ${MAX_VERIFY_LEADS} positive integers` })
    }

    try {
      const leads = await prisma.lead.findMany({
        where: { id: { in: [...new Set(leadIds as number[])] } },
        select: { id: true, email: true },
        orderBy: { id: 'asc' },
      })

      if (leads.length === 0) {
        return res.status(404).json({ error: 'No leads found with the provided IDs' })
      }

      // Mark first, so the response and the next poll already show progress.
      await prisma.lead.updateMany({
        where: { id: { in: leads.map((lead) => lead.id) } },
        data: { emailVerificationStatus: 'PENDING' },
      })

      const outcomes = await Promise.allSettled(leads.map((lead) => startEmailVerification(lead)))
      const started: number[] = []
      const failed: Array<{ leadId: number; error: string }> = []
      outcomes.forEach((outcome, index) => {
        const leadId = leads[index].id
        if (outcome.status === 'fulfilled') started.push(leadId)
        else failed.push({ leadId, error: errorMessage(outcome.reason) })
      })

      if (failed.length > 0) {
        await prisma.lead.updateMany({
          where: { id: { in: failed.map((f) => f.leadId) } },
          data: { emailVerificationStatus: 'FAILED' },
        })
      }

      res.status(202).json({ started, failed })
    } catch (error) {
      console.error('Error starting email verification:', error)
      res.status(500).json({ error: 'Failed to start email verification' })
    }
  })

  return app
}
