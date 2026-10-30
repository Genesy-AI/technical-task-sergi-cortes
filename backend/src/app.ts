import { PrismaClient } from '@prisma/client'
import express, { Express, Request, Response } from 'express'
import { StartVerification, temporalVerificationStarter } from './emailVerification/start'
import { getTemporalClient } from './temporal/client'
import { normalizeCountryCode } from './utils/countryCode'
import { generateMessageFromTemplate } from './utils/messageGenerator'

/** Upper bounds that keep the normalize endpoint cheap; a preview sends only distinct values. */
const MAX_NORMALIZE_VALUES = 1000
const MAX_COUNTRY_VALUE_LENGTH = 100
/** Upper bound on leads per verification request, so one request cannot start unbounded work. */
const MAX_VERIFY_LEADS = 500

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error')

export interface AppDependencies {
  /** Defaults to starting a Temporal workflow through the shared client. */
  startEmailVerification?: StartVerification
}

/** Clients may send numeric codes as JSON numbers, so any non-null value is read as text. */
const toCountryCode = (value: unknown): string | null =>
  normalizeCountryCode(value == null ? null : String(value)).code

/**
 * Builds the HTTP API without starting a server or the Temporal worker,
 * so tests can exercise routes against their own database.
 */
export function createApp(
  prisma: PrismaClient,
  { startEmailVerification = temporalVerificationStarter(getTemporalClient) }: AppDependencies = {}
): Express {
  const app = express()
  app.use(express.json())

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
    const leads = await prisma.lead.findMany()

    res.json(leads)
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
      const leads = await prisma.lead.findMany({
        where: {
          id: {
            in: leadIds.map((id) => Number(id)),
          },
        },
      })

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

  // Lets the CSV import preview show exactly what the bulk import will store, without duplicating the rules.
  app.post('/leads/country-codes/normalize', (req: Request, res: Response) => {
    const values: unknown = req.body?.values

    if (!Array.isArray(values)) {
      return res.status(400).json({ error: 'values must be an array of strings' })
    }
    if (values.length > MAX_NORMALIZE_VALUES) {
      return res.status(400).json({ error: `values must contain at most ${MAX_NORMALIZE_VALUES} entries` })
    }
    if (!values.every((value) => typeof value === 'string' && value.length <= MAX_COUNTRY_VALUE_LENGTH)) {
      return res
        .status(400)
        .json({ error: `every value must be a string of at most ${MAX_COUNTRY_VALUE_LENGTH} characters` })
    }

    res.json({ results: values.map((value: string) => ({ value, ...normalizeCountryCode(value) })) })
  })

  app.post('/leads/bulk', async (req: Request, res: Response) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
    }

    const { leads } = req.body

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'leads must be a non-empty array' })
    }

    try {
      const validLeads = leads.filter((lead) => {
        return (
          lead.firstName &&
          lead.lastName &&
          lead.email &&
          typeof lead.firstName === 'string' &&
          lead.firstName.trim() &&
          typeof lead.lastName === 'string' &&
          lead.lastName.trim() &&
          typeof lead.email === 'string' &&
          lead.email.trim()
        )
      })

      if (validLeads.length === 0) {
        return res
          .status(400)
          .json({ error: 'No valid leads found. firstName, lastName, and email are required.' })
      }

      const existingLeads = await prisma.lead.findMany({
        where: {
          OR: validLeads.map((lead) => ({
            AND: [{ firstName: lead.firstName.trim() }, { lastName: lead.lastName.trim() }],
          })),
        },
      })

      const leadKeys = new Set(
        existingLeads.map((lead) => `${lead.firstName.toLowerCase()}_${(lead.lastName || '').toLowerCase()}`)
      )

      const uniqueLeads = validLeads.filter((lead) => {
        const key = `${lead.firstName.toLowerCase()}_${lead.lastName.toLowerCase()}`
        return !leadKeys.has(key)
      })

      let importedCount = 0
      const errors: Array<{ lead: any; error: string }> = []

      for (const lead of uniqueLeads) {
        try {
          await prisma.lead.create({
            data: {
              firstName: lead.firstName.trim(),
              lastName: lead.lastName.trim(),
              email: lead.email.trim(),
              jobTitle: lead.jobTitle ? lead.jobTitle.trim() : null,
              countryCode: toCountryCode(lead.countryCode),
              companyName: lead.companyName ? lead.companyName.trim() : null,
            },
          })
          importedCount++
        } catch (error) {
          errors.push({
            lead: lead,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      res.json({
        success: true,
        importedCount,
        duplicatesSkipped: validLeads.length - uniqueLeads.length,
        invalidLeads: leads.length - validLeads.length,
        errors,
      })
    } catch (error) {
      console.error('Error importing leads:', error)
      res.status(500).json({ error: 'Failed to import leads' })
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
