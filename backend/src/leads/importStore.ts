import { Prisma, PrismaClient } from '@prisma/client'
import { ImportPlan, PlannedLead } from './importLeads'

/** Returns the lowercased emails among `emails` that already belong to a lead, ignoring case. */
export async function findExistingEmails(
  prisma: PrismaClient,
  emails: readonly string[]
): Promise<Set<string>> {
  const candidates = [...new Set(emails.map((email) => email.trim().toLowerCase()))]
  if (candidates.length === 0) return new Set()

  const rows = await prisma.$queryRaw<{ email: string }[]>(
    Prisma.sql`SELECT lower("email") AS "email" FROM "lead" WHERE lower("email") IN (${Prisma.join(candidates)})`
  )
  return new Set(rows.map((row) => row.email))
}

/** Emails that appear in the raw rows, under any recognized email header. */
export const emailsInRows = (plan: ImportPlan) => plan.leads.map((lead) => lead.email)

export interface ImportResult {
  importedCount: number
  errors: Array<{ email: string; error: string }>
}

/** Creates every `new` lead in the plan with its roles, one atomic write per person. */
export async function executeImport(prisma: PrismaClient, plan: ImportPlan): Promise<ImportResult> {
  const result: ImportResult = { importedCount: 0, errors: [] }

  for (const lead of plan.leads.filter((planned) => planned.status === 'new')) {
    try {
      await prisma.lead.create({ data: toCreateInput(lead) })
      result.importedCount++
    } catch (error) {
      result.errors.push({
        email: lead.email,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  return result
}

const toCreateInput = (lead: PlannedLead): Prisma.leadCreateInput => ({
  firstName: lead.firstName,
  lastName: lead.lastName,
  email: lead.email,
  phone: lead.phone,
  phoneSource: lead.phone ? 'IMPORT' : null,
  linkedinUrl: lead.linkedinUrl,
  countryCode: lead.countryCode,
  jobTitle: lead.jobTitle,
  companyName: lead.companyName,
  roles: {
    create: lead.roles.map((role, position) => ({
      position,
      jobTitle: role.jobTitle,
      companyName: role.companyName,
      yearsInRole: role.yearsInRole,
      isCurrent: role.isCurrent,
    })),
  },
})
