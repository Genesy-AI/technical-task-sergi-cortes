import { PrismaClient } from '@prisma/client'
import express, { Express, Request, Response } from 'express'
import { Connection, Client } from '@temporalio/client'
import { verifyEmailWorkflow } from './workflows'
import { normalizeCountryCode } from './utils/countryCode'
import { generateMessageFromTemplate } from './utils/messageGenerator'

/** Upper bounds that keep the normalize endpoint cheap; a preview sends only distinct values. */
const MAX_NORMALIZE_VALUES = 1000
const MAX_COUNTRY_VALUE_LENGTH = 100

/** Clients may send numeric codes as JSON numbers, so any non-null value is read as text. */
const toCountryCode = (value: unknown): string | null =>
  normalizeCountryCode(value == null ? null : String(value)).code

/**
 * Builds the HTTP API without starting a server or the Temporal worker,
 * so tests can exercise routes against their own database.
 */
export function createApp(prisma: PrismaClient): Express {
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

  app.post('/leads/verify-emails', async (req: Request, res: Response) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body is required and must be valid JSON' })
    }

    const { leadIds } = req.body as { leadIds?: number[] }

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds must be a non-empty array' })
    }

    try {
      const leads = await prisma.lead.findMany({
        where: { id: { in: leadIds.map((id) => Number(id)) } },
      })

      if (leads.length === 0) {
        return res.status(404).json({ error: 'No leads found with the provided IDs' })
      }

      const connection = await Connection.connect({ address: 'localhost:7233' })
      const client = new Client({ connection, namespace: 'default' })

      let verifiedCount = 0
      const results: Array<{ leadId: number; emailVerified: boolean }> = []
      const errors: Array<{ leadId: number; leadName: string; error: string }> = []

      for (const lead of leads) {
        try {
          // The workflow now records the outcome itself; this synchronous route is replaced in task 5.2.
          const outcome = await client.workflow.execute(verifyEmailWorkflow, {
            taskQueue: 'myQueue',
            workflowId: `verify-email-${lead.id}-${Date.now()}`,
            args: [lead.id, lead.email],
          })
          const isVerified = outcome === 'VERIFIED'

          results.push({ leadId: lead.id, emailVerified: isVerified })
          verifiedCount += 1
        } catch (error) {
          errors.push({
            leadId: lead.id,
            leadName: `${lead.firstName} ${lead.lastName}`.trim(),
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      await connection.close()

      res.json({ success: true, verifiedCount, results, errors })
    } catch (error) {
      console.error('Error verifying emails:', error)
      res.status(500).json({ error: 'Failed to verify emails' })
    }
  })

  return app
}
